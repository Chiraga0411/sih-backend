// src/controllers/citizenController.js
// Public, unauthenticated endpoints — matches Section 4's requirement that
// the citizen-facing surface has "no login" and is entirely separate from
// the admin dashboard. Thin HTTP layer: validation + shaping only, all
// real orchestration lives in services/grievanceService.js.

import Grievance from '../models/Grievance.js';
import { sendTemplatedMessage } from '../services/notificationService.js';
import * as grievanceService from '../services/grievanceService.js';
import * as sttService from '../services/sttService.js';
import { applyTrustEvent } from '../services/trustService.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

/**
 * POST /api/citizen/intake
 * Steps 2-4: run classification on raw text and report whether a
 * clarifying question is needed. Nothing is persisted here — see the
 * module comment in grievanceService.js for why.
 */
export const intake = asyncHandler(async (req, res) => {
  const { text, language = 'en', location } = req.body;
  const result = await grievanceService.classifyIntake({ text, language, location });
  res.status(200).json({ success: true, ...result });
});

/**
 * POST /api/citizen/intake/voice
 * Step 2 — citizen speaks instead of types. Runs Bhashini ASR
 * (aiService.transcribeVoice) on the uploaded audio, then feeds the
 * resulting transcript through the exact same Step 2-4 pipeline as the
 * text `intake` endpoint above, so the client gets an identical response
 * shape (complete / needs-clarification) regardless of input mode.
 * Expects multipart/form-data: `audio` file field + `language` + optional
 * `location.lat`/`location.lng` fields. See middlewares/uploadMiddleware.js.
 */
export const intakeVoice = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('audio file is required (multipart field name: "audio")', 400);
  }

  const languageHint = req.body.language || 'hi';
  const location =
    req.body['location.lat'] && req.body['location.lng']
      ? { lat: Number(req.body['location.lat']), lng: Number(req.body['location.lng']) }
      : undefined;

  const transcription = await sttService.transcribe(req.file.buffer, {
    filename: req.file.originalname,
    mime: req.file.mimetype,
    lang: languageHint,
  });

  if (transcription.degraded || !transcription.transcript) {
    // ASR unavailable/failed — don't silently proceed with an empty
    // transcript through the classifier; tell the client explicitly so it
    // can fall back to the text-entry flow.
    throw new AppError(
      'Speech-to-text is temporarily unavailable. Please type your complaint instead.',
      503,
      { reason: transcription.error || 'ASR service unreachable' }
    );
  }

  const result = await grievanceService.classifyIntake({
    text: transcription.transcript,
    language: transcription.language || languageHint,
    location,
  });

  res.status(200).json({
    success: true,
    transcript: transcription.transcript,
    transcriptionConfidence: transcription.confidence,
    sttProvider: transcription.provider,
    ...result,
  });
});

/**
 * POST /api/citizen/grievances
 * Step 5 (confirmation received) through Step 10 (SLA timer started).
 * Body must include the citizen-confirmed/corrected classification +
 * department + location from the intake step.
 */
export const submitGrievance = asyncHandler(async (req, res) => {
  const {
    text,
    language = 'en',
    channel,
    location,
    addressText,
    classification,
    departmentId,
    citizen: citizenInput,
  } = req.body;

  if (!channel || !['WEB', 'MOBILE_APP'].includes(channel)) {
    throw new AppError('channel must be WEB or MOBILE_APP', 400);
  }
  // Identity comes from the verified token, never from the request body.
  const citizen = { phone: req.citizen.phone, name: citizenInput?.name || req.citizen.name };

  const result = await grievanceService.submitGrievance({
    text,
    language,
    channel,
    location,
    addressText,
    classification,
    departmentId,
    citizen,
  });

  res.status(result.duplicate ? 200 : 201).json({ success: true, ...result });
});

/**
 * GET /api/citizen/grievances/:complaintId
 * Tracking lookup — core to a system whose name literally includes
 * "Tracking." Deliberately returns only citizen-safe fields (no internal
 * staff assignment, no raw classification confidence scores, etc).
 */
export const trackGrievance = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findOne({ complaintId: req.params.complaintId }).populate('department', 'name');

  if (!grievance) {
    throw new AppError(`No grievance found for complaint ID ${req.params.complaintId}`, 404);
  }

  res.status(200).json({
    success: true,
    complaintId: grievance.complaintId,
    status: grievance.status,
    department: grievance.department?.name,
    createdAt: grievance.createdAt,
    slaTarget: grievance.slaTarget,
    slaBreached: grievance.slaBreached,
    statusHistory: grievance.statusHistory,
    resolvedAt: grievance.resolvedAt,
  });
});

/**
 * POST /api/citizen/grievances/:complaintId/feedback
 * Step 14 — "Citizen confirms resolution and rates the experience;
 * feedback is logged for future reference."
 */
export const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, comment, confirmedResolved } = req.body;

  if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    throw new AppError('rating must be a number between 1 and 5', 400);
  }

  const grievance = await Grievance.findOne({ complaintId: req.params.complaintId }).populate('citizen');
  if (!grievance) {
    throw new AppError(`No grievance found for complaint ID ${req.params.complaintId}`, 404);
  }
  if (grievance.status !== 'RESOLVED') {
    throw new AppError('Feedback can only be submitted once a grievance is marked RESOLVED', 409);
  }

  const alreadyConfirmed = Boolean(grievance.feedback?.citizenConfirmedResolved);
  grievance.feedback = {
    rating,
    comment,
    submittedAt: new Date(),
    citizenConfirmedResolved: Boolean(confirmedResolved),
  };
  await grievance.save();

  if (confirmedResolved && !alreadyConfirmed && grievance.citizen) {
    await applyTrustEvent(grievance.citizen._id, 'resolved_confirmed');
  }

  res.status(200).json({ success: true, complaintId: grievance.complaintId, feedback: grievance.feedback });
});

// Exposed mainly for completeness/testing — lets a channel trigger a
// resend of the "how did we do" prompt (Step 14) independent of the
// automatic one that status updates could trigger.
export const requestFeedback = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findOne({ complaintId: req.params.complaintId }).populate('citizen');
  if (!grievance) throw new AppError('Grievance not found', 404);

  const result = await sendTemplatedMessage(
    grievance.citizen,
    'FEEDBACK_REQUEST',
    { complaintId: grievance.complaintId },
    grievance.language
  );
  res.status(200).json({ success: true, ...result });
});

export default { intake, intakeVoice, submitGrievance, trackGrievance, submitFeedback, requestFeedback };
