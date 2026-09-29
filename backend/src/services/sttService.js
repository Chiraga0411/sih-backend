// src/services/sttService.js
// Pluggable speech-to-text. Every provider implements the same shape and the
// order/fallbacks come from env (STT_ORDER=sarvam,indic,gemini), so switching
// providers — e.g. if Gemini is not approved for government data — is a
// config change, not a code change. Providers with no credentials are skipped.
//
// NOTE: check the Sarvam request fields against their current API docs before
// production; the AI4Bharat provider expects your own small service that
// accepts multipart {file, lang} and returns {text, confidence}.

import env from '../config/env.js';
import { transcribeWithGemini } from './aiService.js';

const LANG_CODES = {
  hindi: 'hi', english: 'en', bengali: 'bn', tamil: 'ta', telugu: 'te', marathi: 'mr',
  gujarati: 'gu', kannada: 'kn', malayalam: 'ml', punjabi: 'pa', odia: 'od',
};

// The frontend sends language NAMES ("Hindi"); APIs want codes ("hi").
export function toLangCode(lang = 'hi') {
  const l = String(lang).trim().toLowerCase();
  return LANG_CODES[l] || (l.length <= 3 ? l.split('-')[0] : 'hi');
}

async function postForm(url, { headers = {}, fields, buffer, mime, filename }) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime || 'audio/webm' }), filename || 'audio');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.stt.timeoutMs);
  try {
    const res = await fetch(url, { method: 'POST', headers, body: form, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const providers = {
  sarvam: {
    isConfigured: () => Boolean(env.stt.sarvam.apiKey),
    async transcribe({ buffer, mime, filename, langCode }) {
      const j = await postForm('https://api.sarvam.ai/speech-to-text', {
        headers: { 'api-subscription-key': env.stt.sarvam.apiKey },
        fields: { model: env.stt.sarvam.model, language_code: `${langCode}-IN` },
        buffer, mime, filename,
      });
      return { transcript: j.transcript, confidence: undefined };
    },
  },

  indic: {
    isConfigured: () => Boolean(env.stt.indic.url),
    async transcribe({ buffer, mime, filename, langCode }) {
      const j = await postForm(env.stt.indic.url, { fields: { lang: langCode }, buffer, mime, filename });
      return { transcript: j.text, confidence: j.confidence };
    },
  },

  gemini: {
    isConfigured: () => Boolean(env.gemini.apiKey),
    async transcribe({ buffer, mime, filename, lang }) {
      const r = await transcribeWithGemini(buffer, filename, lang, mime);
      if (r.degraded || !r.transcript) throw new Error(r.error || 'empty transcript');
      return { transcript: r.transcript, confidence: r.confidence };
    },
  },
};

/**
 * @returns {{transcript, confidence, language, provider, latencyMs, degraded}}
 * degraded=true (and empty transcript) means every provider failed — callers
 * should ask the citizen to type instead of blocking the report.
 */
export async function transcribe(buffer, { filename = 'audio.webm', mime = '', lang = 'hi' } = {}) {
  const langCode = toLangCode(lang);
  const attempts = [];

  for (const name of env.stt.order) {
    const provider = providers[name];
    if (!provider || !provider.isConfigured()) continue;
    const t0 = Date.now();
    try {
      const out = await provider.transcribe({ buffer, mime, filename, lang, langCode });
      const latencyMs = Date.now() - t0;
      const transcript = (out.transcript || '').trim();
      console.log(`[stt] ${name} ok in ${latencyMs}ms (conf=${out.confidence ?? 'n/a'})`);
      if (!transcript) throw new Error('empty transcript');
      if (out.confidence !== undefined && out.confidence < env.stt.minConfidence) {
        throw new Error(`low confidence ${out.confidence}`);
      }
      return { transcript, confidence: out.confidence, language: langCode, provider: name, latencyMs, degraded: false };
    } catch (err) {
      console.warn(`[stt] ${name} failed: ${err.message}`);
      attempts.push(`${name}: ${err.message}`);
    }
  }

  return {
    transcript: '', confidence: 0, language: langCode, provider: null, degraded: true,
    error: attempts.length ? attempts.join(' | ') : 'No speech-to-text provider is configured',
  };
}

export default { transcribe, toLangCode };
