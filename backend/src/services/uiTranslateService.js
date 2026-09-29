// src/services/uiTranslateService.js
// Translates interface text (buttons, headings, messages) with Sarvam Translate.
// The browser never sees the Sarvam key — it calls our API, we call Sarvam,
// and every result is cached in MongoDB (see models/UiTranslation.js).
//
// Sarvam request: POST https://api.sarvam.ai/translate
//   header  api-subscription-key
//   body    { input, source_language_code, target_language_code, model }
//   limit   1000 chars per call for mayura:v1 (2000 for sarvam-translate:v1)

import axios from 'axios';
import env from '../config/env.js';
import UiTranslation from '../models/UiTranslation.js';
import AppError from '../utils/AppError.js';

// Language names the frontend sends -> Sarvam language codes.
// (English needs no translation; Hindi/Bengali/Marathi/Punjabi/Tamil are all
// supported by both mayura:v1 and sarvam-translate:v1.)
export const UI_LANGUAGES = {
  Hindi: 'hi-IN',
  Marathi: 'mr-IN',
  Tamil: 'ta-IN',
  Bengali: 'bn-IN',
  Punjabi: 'pa-IN',
};

export const MAX_STRINGS_PER_REQUEST = 60;
export const MAX_STRING_LENGTH = 400;
const CONCURRENCY = 4;

// "{dept}" style placeholders must survive translation untouched, otherwise
// the UI would show broken text. If they don't, we discard that translation.
const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join('|');

async function translateOne(text, targetCode) {
  const { data } = await axios.post(
    env.translate.url,
    {
      input: text,
      source_language_code: 'en-IN',
      target_language_code: targetCode,
      model: env.translate.model,
    },
    {
      headers: {
        'api-subscription-key': env.stt.sarvam.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: env.translate.timeoutMs,
    }
  );

  const out = typeof data?.translated_text === 'string' ? data.translated_text.trim() : '';
  if (!out) throw new Error('empty translation');
  if (placeholders(out) !== placeholders(text)) throw new Error('placeholder mismatch');
  return out;
}

/**
 * @param {string} languageName  e.g. "Punjabi"
 * @param {string[]} strings     English source strings
 * @returns {Promise<Record<string,string>>}  only strings that could be translated
 */
export async function translateStrings(languageName, strings) {
  const target = UI_LANGUAGES[languageName];
  if (!target) throw new AppError(`Unsupported language: ${languageName}`, 400);
  if (!env.stt.sarvam.apiKey) {
    throw new AppError('Translation is not configured (SARVAM_API_KEY is missing).', 503);
  }

  const unique = [...new Set(strings.map((s) => String(s).trim()).filter(Boolean))];
  const result = {};

  // 1) cache
  const cached = await UiTranslation.find({ lang: target, source: { $in: unique } }).lean();
  for (const row of cached) result[row.source] = row.text;

  // 2) translate what's missing, a few at a time
  const missing = unique.filter((s) => !(s in result));
  const fresh = [];
  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const source = missing[next++];
      try {
        const text = await translateOne(source, target);
        result[source] = text;
        fresh.push({ source, text });
      } catch (err) {
        const status = err.response?.status;
        console.warn(`[ui-translate] "${source.slice(0, 40)}" -> ${target} failed: ${status || ''} ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker));

  // 3) remember new translations
  if (fresh.length) {
    try {
      await UiTranslation.bulkWrite(
        fresh.map((f) => ({
          updateOne: {
            filter: { lang: target, source: f.source },
            update: { $set: { text: f.text, model: env.translate.model } },
            upsert: true,
          },
        }))
      );
    } catch (err) {
      console.warn('[ui-translate] cache write failed:', err.message);
    }
  }

  return result;
}

export default { translateStrings, UI_LANGUAGES };
