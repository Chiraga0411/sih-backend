// src/routes/uiTranslateRoutes.js
// Public (the language screen appears before any login). Each endpoint has its own
// rate limit because every cache miss costs a Sarvam call.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { translateUi } from '../controllers/uiTranslateController.js';
import { speakText } from '../controllers/speechController.js';

const router = Router();

const translateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ success: false, message: 'Too many translation requests. Please slow down.' }),
});

router.post('/translate', translateLimiter, translateUi);

// Spoken greeting (Sarvam Text-to-Speech, cached). Only allowlisted sentences can be
// synthesised, and cache hits cost nothing, so this limit is generous.
const speakLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ success: false, message: 'Too many voice requests. Please slow down.' }),
});

router.get('/speak', speakLimiter, speakText);

export default router;
