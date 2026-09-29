// src/services/ttsService.js
// Turns a short UI sentence into speech with Sarvam Text-to-Speech (Bulbul).
//
//   English text --(uiTranslateService, cached)--> text in the citizen's language
//                --(Sarvam TTS, cached)-----------> audio bytes
//
// The translation step reuses the SAME cache as the on-screen text, so what the
// citizen hears is word-for-word what the chat shows.
//
// Sarvam request: POST https://api.sarvam.ai/text-to-speech
//   header  api-subscription-key
//   body    { text, language_code, model, speaker, pace, output_audio_codec }
//   reply   { request_id, audios: [ <base64 audio>, ... ] }   (join, then decode)
//   limit   2500 chars per call for bulbul:v3

import axios from 'axios';
import env from '../config/env.js';
import TtsAudio from '../models/TtsAudio.js';
import AppError from '../utils/AppError.js';
import { translateStrings, UI_LANGUAGES } from './uiTranslateService.js';

// Same languages as the UI, plus English (no translation needed).
export const TTS_LANGUAGES = { ...UI_LANGUAGES, English: 'en-IN' };

// The greeting spoken when the chat opens. The frontend shows the exact same
// English string (translated) as the bot's first message.
export const GREETING_TEXT =
  'Welcome to Nagrik Sahayak. Please tell me your problem. You can type, or tap the mic and speak.';

// Only these sentences can be synthesised. Without an allowlist this public
// endpoint would let anyone turn our Sarvam credits into free speech.
export const SPEAKABLE_TEXTS = new Set([GREETING_TEXT]);

const CONTENT_TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav' };
export const contentTypeFor = (codec) => CONTENT_TYPES[codec] || 'application/octet-stream';

// Several citizens opening the chat at once on a cold cache should cost ONE Sarvam call.
const inFlight = new Map();

async function synthesise(spokenText, langCode) {
  let data;
  try {
    ({ data } = await axios.post(
      env.tts.url,
      {
        text: spokenText,
        language_code: langCode,
        model: env.tts.model,
        speaker: env.tts.speaker,
        pace: env.tts.pace,
        output_audio_codec: env.tts.codec,
      },
      {
        headers: {
          'api-subscription-key': env.stt.sarvam.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: env.tts.timeoutMs,
      }
    ));
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.error?.message || err.message;
    console.warn(`[tts] Sarvam request failed (${status || 'no status'}): ${detail}`);
    throw new AppError('Voice is temporarily unavailable.', 502);
  }

  const b64 = Array.isArray(data?.audios) ? data.audios.join('') : '';
  const audio = b64 ? Buffer.from(b64, 'base64') : null;
  if (!audio || audio.length === 0) {
    console.warn('[tts] Sarvam returned no audio');
    throw new AppError('Voice is temporarily unavailable.', 502);
  }
  return audio;
}

async function build(languageName, text) {
  const lang = TTS_LANGUAGES[languageName];
  // The cache key includes the pace (stored inside the "speaker" field so the existing
  // unique index still works): change SARVAM_TTS_PACE or the voice and fresh audio is
  // generated automatically, no manual cache clearing needed.
  const key = {
    lang,
    source: text,
    model: env.tts.model,
    speaker: `${env.tts.speaker}@${env.tts.pace}`,
    codec: env.tts.codec,
  };

  // 1) audio cache — the normal path after the first citizen per language
  // (not .lean(): a hydrated document hands back a real Buffer, lean gives a raw BSON Binary)
  const hit = await TtsAudio.findOne(key);
  if (hit) return { audio: Buffer.from(hit.audio), codec: hit.codec };

  // 2) text in the citizen's language (cached by the translation service)
  let spoken = text;
  if (languageName !== 'English') {
    const map = await translateStrings(languageName, [text]);
    spoken = map[text];
    if (!spoken) throw new AppError('Voice is temporarily unavailable.', 502);
  }

  // 3) speech
  const audio = await synthesise(spoken, lang);

  try {
    await TtsAudio.updateOne(key, { $set: { spoken, audio } }, { upsert: true });
  } catch (err) {
    console.warn('[tts] cache write failed:', err.message);
  }
  return { audio, codec: env.tts.codec };
}

/**
 * @param {string} languageName  e.g. "Punjabi" or "English"
 * @param {string} text          must be one of SPEAKABLE_TEXTS
 * @returns {Promise<{audio: Buffer, codec: string}>}
 */
export async function speak(languageName, text) {
  if (!TTS_LANGUAGES[languageName]) throw new AppError(`Unsupported language: ${languageName}`, 400);
  if (!SPEAKABLE_TEXTS.has(text)) throw new AppError('This text cannot be spoken.', 400);
  if (!env.stt.sarvam.apiKey) {
    throw new AppError('Voice is not configured (SARVAM_API_KEY is missing).', 503);
  }

  const id = `${languageName}|${text}`;
  if (!inFlight.has(id)) {
    inFlight.set(id, build(languageName, text).finally(() => inFlight.delete(id)));
  }
  return inFlight.get(id);
}

export default { speak, TTS_LANGUAGES, SPEAKABLE_TEXTS, GREETING_TEXT, contentTypeFor };
