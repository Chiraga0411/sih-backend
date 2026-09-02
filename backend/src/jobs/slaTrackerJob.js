// src/jobs/slaTrackerJob.js
// Step 10 — "SLA Timer Starts: A scheduled job (cron / task queue) begins
// tracking the complaint's age against its SLA resolution window."
// Step 13 — breached tickets are handed off to escalationJob.escalateGrievance,
// as are tickets that were already escalated once but have since stalled
// (see runReescalationSweep below) — Step 13 only spells out the first
// escalation explicitly, but a ticket that's still untouched well past that
// point needs the same automatic pressure applied again rather than sitting
// at "escalated" forever with no further nudge.
//
// Implementation choice: node-cron running in-process on a fixed interval
// (SLA_CRON_EXPRESSION, default every 15 minutes) rather than one setTimeout
// per grievance. That keeps this stateless and restart-safe — a server
// restart never "loses" a scheduled escalation, because there's nothing
// scheduled per-document; every tick just re-queries "what's overdue right
// now." At production scale, swap node-cron for a real task queue
// (BullMQ/Agenda) so this doesn't run duplicated across multiple app
// instances — see the guard note below.

import cron from 'node-cron';
import mongoose from 'mongoose';
import Grievance from '../models/Grievance.js';
import { escalateGrievance, findStaleEscalations } from './escalationJob.js';
import env from '../config/env.js';

const OPEN_STATUSES = ['LODGED', 'ASSIGNED', 'IN_PROGRESS'];

/**
 * One tick of the SLA tracker: finds every open grievance whose slaTarget
 * has passed and hasn't already been flagged, marks it breached, and
 * escalates it. Exported directly (not just the cron wrapper) so it can be
 * invoked on-demand from tests or an admin "run SLA check now" endpoint.
 */
export async function runSlaSweep() {
  const now = new Date();

  const breaches = await Grievance.find({
    status: { $in: OPEN_STATUSES },
    slaTarget: { $lt: now },
    slaBreached: false,
  }).populate('citizen');

  for (const grievance of breaches) {
    // eslint-disable-next-line no-await-in-loop
    grievance.slaBreached = true;
    // eslint-disable-next-line no-await-in-loop
    await grievance.save();
    // eslint-disable-next-line no-await-in-loop
    await escalateGrievance(grievance, { reason: 'SLA_BREACH' });
  }

  if (breaches.length > 0) {
    console.log(`[slaTrackerJob] flagged + escalated ${breaches.length} SLA breach(es) at ${now.toISOString()}`);
  }
  return breaches.length;
}

/**
 * A second, independent sweep run on the same cron tick: catches tickets
 * that were already escalated (once or more) but have sat in ESCALATED
 * status for longer than env.sla.reescalationGraceHours without any further
 * status change — i.e. escalation didn't actually get them unstuck. Each
 * one is escalated again (escalationCount increments, priority bumps
 * further, citizen is re-notified, CPGRAMS is re-synced), so a ticket can't
 * quietly sit at "escalated" indefinitely if the senior officer it landed
 * on doesn't act either.
 *
 * Kept as its own function/export (mirroring runSlaSweep) so it's equally
 * testable and triggerable on-demand, independent of the cron schedule.
 */
export async function runReescalationSweep() {
  const stale = await findStaleEscalations();

  for (const grievance of stale) {
    // eslint-disable-next-line no-await-in-loop
    await escalateGrievance(grievance, { reason: 'STALE_ESCALATION' });
  }

  if (stale.length > 0) {
    console.log(`[slaTrackerJob] re-escalated ${stale.length} stale ESCALATED ticket(s)`);
  }
  return stale.length;
}

let scheduledTask = null;

/**
 * Starts the recurring cron schedule. Call once from server.js after the
 * DB connection is established.
 *
 * NOTE on horizontal scaling: if this backend ever runs as multiple
 * instances behind a load balancer, guard this so only one instance's
 * cron actually fires (e.g. a Mongo-based leader-election lock, or move
 * scheduling to a dedicated worker process / real task queue).
 */
export function startSlaTrackerJob() {
  if (scheduledTask) return scheduledTask; // idempotent — avoid double-scheduling on hot reload

  scheduledTask = cron.schedule(env.sla.cronExpression, async () => {
    if (mongoose.connection.readyState !== 1) {
      console.warn('[slaTrackerJob] skipping tick: DB not connected');
      return;
    }
    try {
      await runSlaSweep();
      // Runs after runSlaSweep so a ticket that just breached this same
      // tick is never immediately double-counted as "stale" too.
      await runReescalationSweep();
    } catch (err) {
      console.error('[slaTrackerJob] sweep failed:', err);
    }
  });

  console.log(`[slaTrackerJob] scheduled with expression "${env.sla.cronExpression}"`);
  return scheduledTask;
}

export function stopSlaTrackerJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

export default { startSlaTrackerJob, stopSlaTrackerJob, runSlaSweep, runReescalationSweep };
