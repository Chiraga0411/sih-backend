// src/utils/slaCalculator.js
// Step 10 — "SLA Timer Starts": computes the target resolution deadline for
// a freshly-lodged grievance. Base window comes from the assigned
// Department's configured SLA; urgent/critical complaints (Step 9 priority
// triage) get a tightened window so escalation (Step 13) kicks in sooner.

import env from '../config/env.js';

const URGENCY_MULTIPLIER = {
  CRITICAL: 0.25, // 75% reduction — e.g. a 72h SLA becomes 18h
  HIGH: 0.5,
  MEDIUM: 1,
  LOW: 1.25, // slightly relaxed for low-urgency, routine complaints
};

/**
 * @param {number} baseSlaHours - from Department.slaHours (falls back to env default)
 * @param {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} urgencyLevel
 * @param {Date} startedAt - defaults to now
 */
export function calculateSlaTarget(baseSlaHours, urgencyLevel = 'MEDIUM', startedAt = new Date()) {
  const hours = baseSlaHours || env.sla.defaultHours;
  const multiplier = URGENCY_MULTIPLIER[urgencyLevel] ?? 1;
  const effectiveHours = Math.max(1, hours * multiplier);

  const target = new Date(startedAt);
  target.setHours(target.getHours() + effectiveHours);
  return target;
}

export default calculateSlaTarget;
