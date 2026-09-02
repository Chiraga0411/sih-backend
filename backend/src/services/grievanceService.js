// src/services/grievanceService.js
// Orchestrates Phase A (Steps 2-5) and Phase B (Steps 6-10) by composing
// the single-purpose services (aiService, duplicateCheckService,
// cpgramsSyncService, notificationService) plus the id/SLA utils. Kept
// separate from citizenController so the controller stays a thin HTTP
// adapter (parse request -> call service -> shape response) and this
// orchestration logic is unit-testable without spinning up Express.

import mongoose from 'mongoose';
import Grievance from '../models/Grievance.js';
import Citizen from '../models/Citizen.js';
import * as aiService from './aiService.js';
import * as duplicateCheckService from './duplicateCheckService.js';
import * as cpgramsSyncService from './cpgramsSyncService.js';
import * as notificationService from './notificationService.js';
import { generateUniqueComplaintId } from '../utils/idGenerator.js';
import { calculateSlaTarget } from '../utils/slaCalculator.js';
import AppError from '../utils/AppError.js';

/**
 * Steps 2-4: classify raw citizen input and report back whether a
 * clarifying question is needed. Deliberately stateless / non-persisting —
 * the calling channel (WhatsApp bot, IVR flow, web widget) owns
 * conversation state and re-submits the merged fields on the next turn.
 *
 * @param {{ text: string, language: string, location?: { lat, lng } }} input
 */
export async function classifyIntake({ text, language, location }) {
  if (!text || !text.trim()) {
    throw new AppError('text is required to classify a grievance', 400);
  }

  const classification = await aiService.classifyComplaint(text);
  const missing = aiService.checkMissingFields(classification, Boolean(location));

  if (missing) {
    // Step 4 — templated clarifying question, matched to the missing field.
    return {
      complete: false,
      missingField: missing.missingField,
      clarifyingTemplateKey: missing.templateKey,
      classification,
    };
  }

  // Step 5 — enough is known to show the citizen a confirmation preview.
  const department = await aiService.resolveDepartment(classification.departmentCode);
  return {
    complete: true,
    classification,
    departmentPreview: department ? { id: department.id, name: department.name, code: department.code } : null,
  };
}

/**
 * Steps 5-10: citizen has confirmed (or corrected) the classification.
 * Runs the duplicate check, and either merges into an existing ticket or
 * creates + routes + starts the SLA clock on a brand-new one.
 *
 * @param {{
 *   text: string, language: string, channel: string,
 *   location: { lat: number, lng: number }, addressText?: string,
 *   citizen: { phone: string, name?: string, preferredLanguage?: string },
 *   classification: object, departmentId: string
 * }} confirmed
 */
export async function submitGrievance(confirmed) {
  const { text, language, channel, location, addressText, classification, departmentId } = confirmed;

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    throw new AppError('A confirmed location (lat, lng) is required to lodge a grievance', 400);
  }
  if (!mongoose.isValidObjectId(departmentId)) {
    throw new AppError('A valid departmentId is required to lodge a grievance', 400);
  }

  // Step 1/2 identity: upsert the citizen by phone. Citizens never get
  // accounts/passwords (Section 4) — this is purely identity + delivery
  // address for templated notifications.
  const citizen = await Citizen.findOneAndUpdate(
    { phone: confirmed.citizen.phone },
    {
      $set: {
        name: confirmed.citizen.name,
        preferredLanguage: language,
        preferredChannel: channel,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const coords = { lng: location.lng, lat: location.lat };

  // Step 6 — duplicate check (geospatial + semantic).
  const duplicateMatch = await duplicateCheckService.findDuplicate({
    text,
    coords,
    departmentId,
  });

  if (duplicateMatch) {
    // Step 7 (duplicate branch) — merge instead of creating a new ticket.
    const merged = await duplicateCheckService.mergeIntoExisting(duplicateMatch.grievance, {
      citizenId: citizen._id,
      text,
      similarityScore: duplicateMatch.similarityScore,
    });

    await notificationService.sendTemplatedMessage(
      citizen,
      'DUPLICATE_MERGED',
      { complaintId: merged.complaintId },
      language
    );

    return { duplicate: true, complaintId: merged.complaintId, similarityScore: duplicateMatch.similarityScore };
  }

  // Step 7 (new complaint branch) — collision-proof ID.
  const { complaintId, rawUuid } = await generateUniqueComplaintId((candidate) =>
    Grievance.exists({ complaintId: candidate }).then(Boolean)
  );

  // Step 9 — priority triage.
  const urgencyLevel = classification?.urgencyLevel || 'MEDIUM';
  const isUrgentAlert = urgencyLevel === 'CRITICAL' || classification?.sentiment === 'NEGATIVE';
  const priorityScoreByUrgency = { LOW: 25, MEDIUM: 50, HIGH: 75, CRITICAL: 95 };

  // Step 10 — SLA timer starts, scoped to the resolved department's base SLA.
  const departmentDoc = await mongoose.model('Department').findById(departmentId);
  if (!departmentDoc) throw new AppError('Department not found', 404);
  const slaTarget = calculateSlaTarget(departmentDoc.slaHours, urgencyLevel);

  // Step 8 — write into MongoDB (the working store) with status LODGED.
  const grievance = await Grievance.create({
    complaintId,
    rawUuid,
    citizen: citizen._id,
    channel,
    language,
    originalText: text,
    classification: {
      issueType: classification?.issueType,
      confidence: classification?.confidence,
      entities: classification?.entities,
      sentiment: classification?.sentiment,
      citizenConfirmed: true, // this path only runs after Step 5 confirmation
    },
    department: departmentId,
    location: { type: 'Point', coordinates: [coords.lng, coords.lat] },
    addressText,
    status: 'LODGED',
    statusHistory: [{ status: 'LODGED', timestamp: new Date(), updatedBy: 'system:intake' }],
    urgencyLevel,
    priorityScore: priorityScoreByUrgency[urgencyLevel] ?? 50,
    isUrgentAlert,
    slaTarget,
  });

  // Step 9 — immediate admin alert for urgent/negative-sentiment complaints.
  // (Kept as a structured log + the isUrgentAlert flag the staff queue
  // sorts/filters on; wire this to a push/email channel for real ops use.)
  if (isUrgentAlert) {
    console.warn(`[ADMIN ALERT] Urgent grievance lodged: ${grievance.complaintId} (dept: ${departmentDoc.code})`);
  }

  // Step 8 — one-way sync to CPGRAMS (fire, don't block success on it).
  await cpgramsSyncService.syncToCpgrams(grievance);

  // Step 7 — instant complaint ID confirmation back to the citizen.
  await notificationService.sendTemplatedMessage(
    citizen,
    'COMPLAINT_LODGED',
    { complaintId: grievance.complaintId, slaTarget: slaTarget.toISOString() },
    language
  );

  return {
    duplicate: false,
    complaintId: grievance.complaintId,
    status: grievance.status,
    department: { id: departmentDoc.id, name: departmentDoc.name },
    slaTarget,
    isUrgentAlert,
  };
}

export default { classifyIntake, submitGrievance };
