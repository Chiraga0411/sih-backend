// src/services/cpgramsSyncService.js
// Step 8 — "synced to CPGRAMS as the government system of record —
// one-directional write, MongoDB is not a second source of truth."
//
// This implements the System of Record pattern: MongoDB is the team's fast
// working store (what the admin dashboard and duplicate-check queries hit),
// CPGRAMS is authoritative. Sync is push-only — this file has no function
// that reads a grievance's state back from CPGRAMS, by design. If a
// grievance's cpgramsSync.status is ever 'FAILED', the fix is to retry the
// push, never to pull CPGRAMS data into Mongo to "reconcile".
//
// Runs in SIMULATE mode (logs the payload instead of calling out) whenever
// CPGRAMS_API_URL isn't configured, so intake stays fully runnable without
// live government API access.

import axios from 'axios';
import env from '../config/env.js';

function buildCpgramsPayload(grievance) {
  // Shape is illustrative — align field names to the real CPGRAMS grievance
  // submission API contract when integrating.
  return {
    externalReferenceId: grievance.complaintId,
    subject: grievance.classification?.issueType || 'General Grievance',
    description: grievance.translatedText || grievance.originalText,
    department: grievance.department?.name || grievance.department,
    location: {
      lat: grievance.location.coordinates[1],
      lng: grievance.location.coordinates[0],
      address: grievance.addressText,
    },
    lodgedAt: grievance.createdAt,
  };
}

/**
 * One-way push of a grievance to CPGRAMS. Mutates and saves the grievance's
 * cpgramsSync sub-document with the outcome; does not throw on failure so
 * that a CPGRAMS outage never blocks the citizen-facing lodging flow —
 * Step 8 explicitly treats Mongo write + CPGRAMS sync as the working store
 * being available first, sync being best-effort/retryable second.
 */
export async function syncToCpgrams(grievance) {
  const payload = buildCpgramsPayload(grievance);
  grievance.cpgramsSync.lastAttemptAt = new Date();

  const isSimulated = !env.cpgrams.apiUrl;
  if (isSimulated) {
    console.log(`[cpgramsSyncService:SIMULATE] one-way push for ${grievance.complaintId}:`, payload);
    grievance.cpgramsSync.status = 'SYNCED';
    grievance.cpgramsSync.refId = `SIMULATED-${grievance.complaintId}`;
    grievance.cpgramsSync.error = null;
    await grievance.save();
    return { success: true, simulated: true };
  }

  try {
    // Real integration point — align payload field names above
    // (buildCpgramsPayload) to CPGRAMS' actual submission API contract
    // before going live; the shape here is illustrative.
    const { data } = await axios.post(`${env.cpgrams.apiUrl}/grievances`, payload, {
      headers: { Authorization: `Bearer ${env.cpgrams.apiKey}`, 'Content-Type': 'application/json' },
      timeout: 8000,
    });
    grievance.cpgramsSync.status = 'SYNCED';
    grievance.cpgramsSync.refId = data.cpgramsId || data.referenceId || null;
    grievance.cpgramsSync.error = null;
    await grievance.save();
    return { success: true, simulated: false, refId: grievance.cpgramsSync.refId };
  } catch (err) {
    grievance.cpgramsSync.status = 'FAILED';
    grievance.cpgramsSync.error = err.message;
    await grievance.save();
    console.error(`[cpgramsSyncService] sync failed for ${grievance.complaintId}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export default { syncToCpgrams };
