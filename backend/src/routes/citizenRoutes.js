// src/routes/citizenRoutes.js
// Public surface — no auth. Section 4 is explicit this is a separate
// surface from admin and citizens never have accounts, so nothing here
// touches authMiddleware.

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as citizenController from '../controllers/citizenController.js';
import * as citizenAuthController from '../controllers/citizenAuthController.js';
import { handleAudioUpload } from '../middlewares/uploadMiddleware.js';
import { protectCitizen } from '../middlewares/citizenAuth.js';
import { verifyTurnstile } from '../middlewares/turnstile.js';
import {
  citizenIpLimiter, otpIpLimiter, otpPhoneLimiter, otpVerifyLimiter,
  intakeLimiter, voiceLimiter, submitLimiter,
} from '../middlewares/rateLimiters.js';
import AppError from '../utils/AppError.js';

const router = Router();

router.use(citizenIpLimiter);

function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array().map((e) => e.msg).join('; '), 400));
  }
  return next();
}

// Phone OTP (web/app channels). Order matters: cheap IP limit first, then
// CAPTCHA, then the per-phone limit, so bots can't burn SMS credits.
router.post('/auth/request-otp', otpIpLimiter, verifyTurnstile, otpPhoneLimiter, citizenAuthController.requestOtp);
router.post('/auth/verify-otp', otpVerifyLimiter, citizenAuthController.verifyOtp);

// Steps 2-4: classify + surface a clarifying question if fields are missing.
router.post(
  '/intake',
  [body('text').isString().trim().notEmpty().withMessage('text is required')],
  validate,
  intakeLimiter,
  citizenController.intake
);

// Step 2: voice capture. multipart/form-data — field "audio" (file) +
// "language" + optional "location.lat"/"location.lng". Runs Bhashini ASR
// then the same Step 3-4 classification as /intake.
// Voice costs money (STT), so it needs a verified phone.
router.post('/intake/voice', protectCitizen, voiceLimiter, handleAudioUpload, citizenController.intakeVoice);

// Steps 5-10: confirmed submission -> dedup, ID, routing, priority, SLA start.
router.post(
  '/grievances',
  protectCitizen,
  submitLimiter,
  [
    body('text').isString().trim().notEmpty().withMessage('text is required'),
    // WhatsApp/IVR reports arrive via their own webhooks, never through this public route.
    body('channel').isIn(['WEB', 'MOBILE_APP']).withMessage('channel is invalid'),
    body('location.lat').isFloat({ min: -90, max: 90 }).withMessage('location.lat is required and must be valid'),
    body('location.lng').isFloat({ min: -180, max: 180 }).withMessage('location.lng is required and must be valid'),
    body('departmentId').isString().notEmpty().withMessage('departmentId is required'),
  ],
  validate,
  citizenController.submitGrievance
);

// Tracking lookup.
router.get('/grievances/:complaintId', citizenController.trackGrievance);

// Step 14: resolution feedback.
router.post(
  '/grievances/:complaintId/feedback',
  [body('rating').optional().isInt({ min: 1, max: 5 })],
  validate,
  citizenController.submitFeedback
);
router.post('/grievances/:complaintId/request-feedback', citizenController.requestFeedback);

export default router;
