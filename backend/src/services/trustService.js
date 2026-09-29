// src/services/trustService.js
// trustScore (0-100, starts at 50) + phone blocklist. Used by BOTH channels
// (grievanceService.submitGrievance is the single choke point), so WhatsApp
// and web reports follow identical anti-spam rules.

import Citizen from '../models/Citizen.js';
import Grievance from '../models/Grievance.js';
import BlockedPhone from '../models/BlockedPhone.js';
import AppError from '../utils/AppError.js';

const DELTA = {
  phone_verified: 10,
  resolved_confirmed: 5,
  duplicate: -3,
  rejected_invalid: -10,
  flagged_spam: -25,
  burst: -5,
};

// CRITICAL urgency is set by the AI from the complaint text, so it can be
// gamed. It lifts limits only a little and low-trust users still get reviewed.
const EMERGENCY_EXTRA_PER_DAY = 3;

export async function applyTrustEvent(citizenId, event) {
  const delta = DELTA[event];
  if (delta === undefined) throw new Error(`Unknown trust event: ${event}`);
  return Citizen.findByIdAndUpdate(
    citizenId,
    [{ $set: { trustScore: { $min: [100, { $max: [0, { $add: ['$trustScore', delta] }] }] } } }],
    { new: true }
  );
}

export function policyFor(score) {
  if (score >= 70) return { tier: 'high', dailyLimit: 10, reviewQueue: false };
  if (score >= 30) return { tier: 'normal', dailyLimit: 5, reviewQueue: false };
  if (score >= 10) return { tier: 'restricted', dailyLimit: 2, reviewQueue: true };
  return { tier: 'blocked', dailyLimit: 0, reviewQueue: true };
}

export async function isPhoneBlocked(phone) {
  const b = await BlockedPhone.findOne({ phone });
  return Boolean(b && (!b.expiresAt || b.expiresAt > new Date()));
}

/** Throws AppError if this citizen may not lodge a grievance right now. */
export async function assertCanSubmit(citizen, { urgencyLevel } = {}) {
  if (await isPhoneBlocked(citizen.phone)) {
    throw new AppError('This number cannot submit complaints right now. Please contact the helpline.', 403);
  }

  const policy = policyFor(citizen.trustScore);
  const emergency = urgencyLevel === 'CRITICAL';

  if (policy.tier === 'blocked' && !emergency) {
    throw new AppError('Your account is restricted. Please contact the helpline.', 403);
  }

  const since = new Date(Date.now() - 24 * 3600_000);
  const used = await Grievance.countDocuments({ citizen: citizen._id, createdAt: { $gte: since } });
  const limit = policy.dailyLimit + (emergency ? EMERGENCY_EXTRA_PER_DAY : 0);
  if (used >= limit) {
    throw new AppError('You have reached the daily complaint limit. Please try again tomorrow.', 429);
  }

  // Emergencies are never silently dropped, but low-trust ones get a human look.
  return { ...policy, reviewQueue: policy.reviewQueue };
}

export default { applyTrustEvent, policyFor, isPhoneBlocked, assertCanSubmit };
