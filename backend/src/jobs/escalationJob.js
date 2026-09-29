// src/jobs/escalationJob.js
// Step 13 — "Escalation": if the complaint is not resolved within its SLA
// window, it automatically escalates to a senior officer or another
// department, and returns to Step 11 for continued action.
//
// This module holds the escalation *business logic* only; the *scheduling*
// (deciding which grievances are due for escalation, and when to check) is
// slaTrackerJob.js's responsibility. Kept separate so escalation can also
// be triggered manually later (e.g. an admin "escalate now" button) without
// going through the cron path.

import Staff from '../models/Staff.js';
import Grievance from '../models/Grievance.js';
import { sendTemplatedMessage } from '../services/notificationService.js';
import { syncToCpgrams } from '../services/cpgramsSyncService.js';
import env from '../config/env.js';

const PRIORITY_BUMP_ON_ESCALATION = 20;

// Tickets that are still open after this many repeat escalations get
// reassigned every time regardless of who currently holds them — beyond
// this point "the same senior officer hasn't gotten to it" is itself the
// signal something is stuck, not a reason to leave it alone.
const REASSIGN_EVERY_ESCALATION = true;

/**
 * Escalates a single grievance — either the initial SLA-breach escalation
 * (Step 13) or a later re-escalation of a ticket that has stalled in
 * ESCALATED status past the grace window (see findStaleEscalations below).
 * Bumps priority, flips/refreshes status to ESCALATED, records the
 * transition, notifies the citizen, and re-syncs the updated state to
 * CPGRAMS (Step 8's one-way push applies to every state change, not just
 * creation).
 *
 * "Returns to Step 11" per the workflow means it lands back in a staff
 * queue for continued action — concretely, ESCALATED tickets stay visible
 * in staffController.listGrievances and can be picked up/reassigned to a
 * senior officer via the same assign/update-status endpoints used in the
 * normal flow.
 *
 * @param {import('mongoose').Document} grievance - a Grievance doc, populated with .citizen and .department where possible
 * @param {{ reason?: 'SLA_BREACH' | 'STALE_ESCALATION' }} [options]
 */
export async function escalateGrievance(grievance, { reason = 'SLA_BREACH' } = {}) {
  grievance.status = 'ESCALATED';
  grievance.escalationCount += 1;
  grievance.escalatedAt = new Date();
  grievance.priorityScore = Math.min(100, grievance.priorityScore + PRIORITY_BUMP_ON_ESCALATION);
  grievance.isUrgentAlert = true;
  grievance.statusHistory.push({
    status: 'ESCALATED',
    timestamp: grievance.escalatedAt,
    updatedBy: 'system:sla-tracker',
    note:
      reason === 'STALE_ESCALATION'
        ? `Re-escalated (escalation #${grievance.escalationCount}) — still open ${env.sla.reescalationGraceHours}h+ after previous escalation`
        : `Auto-escalated after SLA breach (escalation #${grievance.escalationCount})`,
  });

  // Simple senior-reassignment stub: clear/refresh the current assignee so
  // the ticket reappears at the top of an admin's unassigned/escalated
  // queue for manual reassignment to a senior officer. On every repeat
  // escalation we deliberately re-pick (rather than leave the existing
  // assignee in place), since "assigned but still stuck" is exactly the
  // case a re-escalation exists to catch. A fuller implementation could
  // look up an explicit "escalation contact" per department, or rotate
  // through senior staff instead of always picking the first active admin.
  if (reason === 'SLA_BREACH' || REASSIGN_EVERY_ESCALATION) {
    const seniorAdmin = await Staff.findOne({ role: 'admin', isActive: true });
    grievance.assignedStaff = seniorAdmin ? seniorAdmin._id : null;
  }

  await grievance.save();

  // Re-sync escalated state to CPGRAMS — one-way, same as every other
  // state change (Step 8).
  await syncToCpgrams(grievance);

  const citizen = grievance.citizen?.phone ? grievance.citizen : await grievance.populate('citizen').then((g) => g.citizen);
  await sendTemplatedMessage(citizen, 'STATUS_ESCALATED', { complaintId: grievance.complaintId }, grievance.language);

  console.warn(
    `[escalationJob] ${grievance.complaintId} escalated (escalation #${grievance.escalationCount}, reason: ${reason})`
  );
  return grievance;
}

// Grievances in these statuses are still open and can be re-escalated if
// they stall. RESOLVED tickets are obviously excluded; a ticket that's
// still ESCALATED itself is the target of this query, so it's excluded
// from the *input* set here but is exactly what STALE_ESCALATION re-checks.
const REESCALATABLE_STATUSES = ['ESCALATED'];

/**
 * Finds tickets that were escalated at least once but have sat in
 * ESCALATED status for longer than env.sla.reescalationGraceHours without
 * further progress (i.e. no status change since). These are handed back to
 * escalateGrievance with reason='STALE_ESCALATION' so a ticket that gets
 * escalated once and then stalls again doesn't just sit there indefinitely
 * with no further automatic pressure behind it.
 *
 * Kept as a separate, explicitly-named query (rather than folded into the
 * SLA-breach query) so "why was this escalated a second time" is always
 * answerable by reading statusHistory, and so the grace window can be
 * tuned independently of the original SLA window.
 */
export async function findStaleEscalations() {
  const graceMs = env.sla.reescalationGraceHours * 60 * 60 * 1000;
  const staleBefore = new Date(Date.now() - graceMs);

  return Grievance.find({
    status: { $in: REESCALATABLE_STATUSES },
    escalatedAt: { $lte: staleBefore },
  }).populate('citizen');
}

export default { escalateGrievance, findStaleEscalations };
