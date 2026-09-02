// src/routes/citizenRoutes.js
// Public surface — no auth. Section 4 is explicit this is a separate
// surface from admin and citizens never have accounts, so nothing here
// touches authMiddleware.

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import * as citizenController from '../controllers/citizenController.js';
import { handleAudioUpload } from '../middlewares/uploadMiddleware.js';
import AppError from '../utils/AppError.js';

const router = Router();

function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array().map((e) => e.msg).join('; '), 400));
  }
  return next();
}

// Steps 2-4: classify + surface a clarifying question if fields are missing.
router.post(
  '/intake',
  [body('text').isString().trim().notEmpty().withMessage('text is required')],
  validate,
  citizenController.intake
);

// Step 2: voice capture. multipart/form-data — field "audio" (file) +
// "language" + optional "location.lat"/"location.lng". Runs Bhashini ASR
// then the same Step 3-4 classification as /intake.
router.post('/intake/voice', handleAudioUpload, citizenController.intakeVoice);

// Steps 5-10: confirmed submission -> dedup, ID, routing, priority, SLA start.
router.post(
  '/grievances',
  [
    body('text').isString().trim().notEmpty().withMessage('text is required'),
    body('channel').isIn(['WHATSAPP', 'WEB', 'MOBILE_APP', 'IVR']).withMessage('channel is invalid'),
    body('location.lat').isFloat({ min: -90, max: 90 }).withMessage('location.lat is required and must be valid'),
    body('location.lng').isFloat({ min: -180, max: 180 }).withMessage('location.lng is required and must be valid'),
    body('departmentId').isString().notEmpty().withMessage('departmentId is required'),
    body('citizen.phone').isString().trim().notEmpty().withMessage('citizen.phone is required'),
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
