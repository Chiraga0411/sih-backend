// src/config/env.js
// Single source of truth for environment configuration. Every other module
// reads config from here instead of touching process.env directly, so the
// whole app fails fast (and loudly) on a missing required variable instead
// of failing mysteriously three layers deep at request time.

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load backend/.env by module location first, then also support starting the
// server from the full-stack root. Existing process environment variables win.
const backendEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length && process.env.NODE_ENV !== 'test') {
  // Fail fast on boot rather than letting auth or DB code throw confusing
  // errors later. Section 4 (admin auth) and every model depend on these.
  console.error(`[config] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[config] Copy .env.example to .env and fill these in.');
  process.exit(1);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

  mongoUri: process.env.MONGO_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

  cpgrams: {
    apiUrl: process.env.CPGRAMS_API_URL || null,
    apiKey: process.env.CPGRAMS_API_KEY || null,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || null,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 10000,
  },

  // Pluggable speech-to-text. STT_ORDER = primary first, then fallbacks.
  // Providers without credentials are skipped automatically.
  stt: {
    order: (process.env.STT_ORDER || 'sarvam,indic,gemini').split(',').map((s) => s.trim()).filter(Boolean),
    timeoutMs: Number(process.env.STT_TIMEOUT_MS) || 15000,
    minConfidence: Number(process.env.STT_MIN_CONFIDENCE) || 0.4,
    sarvam: {
      apiKey: process.env.SARVAM_API_KEY || null,
      model: process.env.SARVAM_STT_MODEL || 'saarika:v2.5',
    },
    indic: { url: process.env.INDIC_STT_URL || null }, // self-hosted AI4Bharat service
  },

  // Phone OTP (web/app channel) + bot protection.
  otp: {
    sender: process.env.OTP_SENDER || 'console', // console | twilio | msg91
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES) || 5,
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
    msg91: {
      authKey: process.env.MSG91_AUTHKEY || null,
      templateId: process.env.MSG91_TEMPLATE_ID || null,
    },
  },
  citizenJwtExpiresIn: process.env.CITIZEN_JWT_EXPIRES_IN || '7d',
  turnstileSecret: process.env.TURNSTILE_SECRET || null,

  // Interface translation through Sarvam Translate (uses SARVAM_API_KEY above).
  // mayura:v1 = 1000 chars/call, 11 languages; sarvam-translate:v1 = 2000 chars/call, 22 languages.
  translate: {
    url: process.env.SARVAM_TRANSLATE_URL || 'https://api.sarvam.ai/translate',
    model: process.env.SARVAM_TRANSLATE_MODEL || 'mayura:v1',
    timeoutMs: Number(process.env.SARVAM_TRANSLATE_TIMEOUT_MS) || 8000,
  },

  // Spoken greeting through Sarvam Text-to-Speech (uses SARVAM_API_KEY above).
  // bulbul:v3 = 2500 chars/call, 30+ voices (bulbul:v2 is legacy/deprecated).
  tts: {
    url: process.env.SARVAM_TTS_URL || 'https://api.sarvam.ai/text-to-speech',
    model: process.env.SARVAM_TTS_MODEL || 'bulbul:v3',
    speaker: process.env.SARVAM_TTS_SPEAKER || 'shubh', // lowercase; must match the model
    pace: Number(process.env.SARVAM_TTS_PACE) || 0.95,  // slightly slower reads clearer
    codec: process.env.SARVAM_TTS_CODEC || 'mp3',       // mp3 (small) | wav
    timeoutMs: Number(process.env.SARVAM_TTS_TIMEOUT_MS) || 15000,
  },

  upload: {
    maxAudioMb: Number(process.env.MAX_AUDIO_UPLOAD_MB) || 10,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || null,
    authToken: process.env.TWILIO_AUTH_TOKEN || null,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || null,
    smsFrom: process.env.TWILIO_SMS_FROM || null,
  },

  duplicateCheck: {
    radiusMeters: Number(process.env.DUPLICATE_RADIUS_METERS) || 300,
    similarityThreshold: Number(process.env.DUPLICATE_SIMILARITY_THRESHOLD) || 0.82,
    lookbackDays: Number(process.env.DUPLICATE_LOOKBACK_DAYS) || 30,
  },

  sla: {
    cronExpression: process.env.SLA_CRON_EXPRESSION || '*/15 * * * *',
    defaultHours: Number(process.env.DEFAULT_SLA_HOURS) || 72,
    // Step 13 — how long a ticket may sit in ESCALATED status before it's
    // treated as stale and escalated again (e.g. bumped to a higher senior
    // officer / re-alerted). Without this, a ticket that gets escalated once
    // but then stalls again has no further automatic pressure behind it.
    reescalationGraceHours: Number(process.env.SLA_REESCALATION_GRACE_HOURS) || 24,
  },
};

export default env;
