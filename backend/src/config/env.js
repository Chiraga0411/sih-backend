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
