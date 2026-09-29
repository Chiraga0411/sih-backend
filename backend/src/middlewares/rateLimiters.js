// src/middlewares/rateLimiters.js
// Per-IP and per-phone limits. In-memory store: fine for a single instance;
// use a Redis store (rate-limit-redis) if you run several instances.

import rateLimit from 'express-rate-limit';
import { normalizePhone } from '../utils/phone.js';

function limiter({ windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, res) => res.status(429).json({ success: false, message }),
  });
}

const MIN = 60_000;

export const citizenIpLimiter = limiter({ windowMs: 15 * MIN, limit: 200, message: 'Too many requests. Please slow down.' });
export const otpIpLimiter = limiter({ windowMs: 15 * MIN, limit: 10, message: 'Too many code requests from this network. Try again later.' });
export const otpPhoneLimiter = limiter({
  windowMs: 15 * MIN,
  limit: 3,
  message: 'Too many codes requested for this number. Try again in 15 minutes.',
  keyGenerator: (req) => normalizePhone(req.body?.phone) || req.ip,
});
export const otpVerifyLimiter = limiter({ windowMs: 15 * MIN, limit: 20, message: 'Too many attempts. Try again later.' });
export const intakeLimiter = limiter({ windowMs: 15 * MIN, limit: 40, message: 'Too many requests. Please wait a few minutes.' });
export const voiceLimiter = limiter({ windowMs: 15 * MIN, limit: 15, message: 'Too many voice uploads. Please wait a few minutes.' });
export const submitLimiter = limiter({ windowMs: 60 * MIN, limit: 15, message: 'Too many submissions. Please try again later.' });
