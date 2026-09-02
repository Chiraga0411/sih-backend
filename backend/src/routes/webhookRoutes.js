// src/routes/webhookRoutes.js
// Step 1 — "Citizen opens the chatbot via WhatsApp ... no login or app
// download required." Twilio POSTs inbound WhatsApp messages here as
// application/x-www-form-urlencoded (standard Twilio webhook shape:
// Body, From, Latitude/Longitude when a location pin is shared).
//
// WhatsApp is stateless per-message from Twilio's side, so this route
// bridges the multi-turn Step 2-5 flow (capture -> classify -> clarify ->
// confirm) using Citizen.pendingIntake as short-lived conversation state —
// see models/Citizen.js. This reuses the exact same grievanceService used
// by the web client (classifyIntake / submitGrievance), so a WhatsApp
// report and a web report go through identical dedup/routing/SLA logic;
// this file is a channel adapter, not a parallel implementation.
//
// Mounted unauthenticated (Twilio can't send a JWT) — protect it instead
// with Twilio's request-signature validation, see verifyTwilioSignature
// below. Set TWILIO_AUTH_TOKEN in .env to enable it.

import { Router } from 'express';
import twilio from 'twilio';
import Citizen from '../models/Citizen.js';
import Department from '../models/Department.js';
import * as aiService from '../services/aiService.js';
import * as grievanceService from '../services/grievanceService.js';
import env from '../config/env.js';

const router = Router();

// Twilio signs every webhook request with X-Twilio-Signature, computed from
// the auth token + the exact URL + POST params. Validates the request
// really came from Twilio (and wasn't replayed/forged) before touching the
// DB. Skipped automatically if TWILIO_AUTH_TOKEN isn't set (local dev
// without a Twilio account) — enable it before exposing this publicly.
function verifyTwilioSignature(req, res, next) {
  if (!env.twilio.authToken) return next(); // SIMULATE mode — see notificationService.js
  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const valid = twilio.validateRequest(env.twilio.authToken, signature, url, req.body);
  if (!valid) {
    return res.status(403).type('text/plain').send('Invalid Twilio signature');
  }
  return next();
}

function twiml(message) {
  const response = new twilio.twiml.MessagingResponse();
  response.message(message);
  return response.toString();
}

const PENDING_INTAKE_TTL_MS = 15 * 60 * 1000; // a stale half-finished report shouldn't silently resume 3 days later

router.post('/whatsapp', verifyTwilioSignature, async (req, res) => {
  const { Body, From, Latitude, Longitude, ProfileName } = req.body;
  const phone = From?.replace('whatsapp:', '') || From;
  const messageText = (Body || '').trim();

  if (!phone) {
    return res.type('text/xml').send(twiml('We could not read your phone number. Please try again.'));
  }

  const citizen = await Citizen.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone, name: ProfileName, preferredChannel: 'WHATSAPP', preferredLanguage: 'hi' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const hasFreshPendingIntake =
    citizen.pendingIntake?.text &&
    citizen.pendingIntake?.updatedAt &&
    Date.now() - citizen.pendingIntake.updatedAt.getTime() < PENDING_INTAKE_TTL_MS;

  const location = Latitude && Longitude ? { lat: parseFloat(Latitude), lng: parseFloat(Longitude) } : undefined;

  try {
    // Resume flow: previous turn was missing a field, this turn should
    // supply it (either a location pin, or more descriptive text).
    if (hasFreshPendingIntake) {
      const combinedText = location ? citizen.pendingIntake.text : `${citizen.pendingIntake.text} ${messageText}`.trim();
      return await runIntakeTurn({ res, citizen, text: combinedText, language: citizen.pendingIntake.language, location });
    }

    if (!messageText) {
      return res.type('text/xml').send(twiml('Please describe the issue in a message, or send a voice note.'));
    }

    return await runIntakeTurn({ res, citizen, text: messageText, language: citizen.preferredLanguage, location });
  } catch (err) {
    console.error('[webhookRoutes:whatsapp] unhandled error:', err);
    return res
      .type('text/xml')
      .send(twiml('Something went wrong on our end. Please try again in a moment, or use the web app.'));
  }
});

/**
 * One classify -> (clarify | confirm-and-submit) turn, shared by both the
 * fresh-report and resume-after-clarification paths above.
 */
async function runIntakeTurn({ res, citizen, text, language, location }) {
  const intakeResult = await grievanceService.classifyIntake({ text, language, location });

  if (!intakeResult.complete) {
    // Step 4 — save state and ask the templated clarifying question.
    await Citizen.updateOne(
      { _id: citizen._id },
      { $set: { pendingIntake: { text, language, updatedAt: new Date() } } }
    );
    const clarifyText = getClarifyingQuestionText(intakeResult.clarifyingTemplateKey, language);
    return res.type('text/xml').send(twiml(clarifyText));
  }

  // Step 5 — WhatsApp has no separate "review" screen; the classification
  // itself stands in as the citizen's confirmation once all required
  // fields are present (this mirrors accepting the AI's read without an
  // explicit edit step, appropriate for a low-friction chat channel).
  const department = await aiService.resolveDepartment(intakeResult.classification.departmentCode);
  if (!department) {
    return res.type('text/xml').send(twiml('We could not route your complaint automatically. Please try the web app.'));
  }

  const submission = await grievanceService.submitGrievance({
    text,
    language,
    channel: 'WHATSAPP',
    location,
    classification: intakeResult.classification,
    departmentId: department.id,
    citizen: { phone: citizen.phone, name: citizen.name },
  });

  // Clear conversation state now that the report is submitted.
  await Citizen.updateOne({ _id: citizen._id }, { $set: { pendingIntake: { text: null, language: null, updatedAt: null } } });

  const confirmationText = submission.duplicate
    ? `A similar complaint is already registered as ${submission.complaintId}. We've linked your report to it.`
    : `Your complaint has been registered. Tracking ID: ${submission.complaintId}. You'll get updates on this number.`;
  return res.type('text/xml').send(twiml(confirmationText));
}

// Minimal inline lookup so the webhook doesn't need to import the full
// notificationService (which is built around citizen-object + Twilio
// send-with-retry, not "give me plain text back for a TwiML reply").
// Real deployments should read from the same templates/messageCatalog.js
// as everything else, keyed by templateKey + language — this trims it to
// what fits a one-line WhatsApp reply.
function getClarifyingQuestionText(templateKey, language) {
  const isHindi = (language || '').toLowerCase().startsWith('hi');
  const CLARIFY_TEXT = {
    CLARIFY_ISSUE_TYPE: isHindi
      ? 'कृपया समस्या के बारे में थोड़ा और विस्तार से बताएं।'
      : 'Could you describe the issue in a bit more detail?',
    CLARIFY_LOCATION: isHindi
      ? 'कृपया स्थान बताएं या अपना GPS पिन साझा करें।'
      : 'Could you share the location, or send your GPS pin?',
  };
  return CLARIFY_TEXT[templateKey] || CLARIFY_TEXT.CLARIFY_ISSUE_TYPE;
}

export default router;
