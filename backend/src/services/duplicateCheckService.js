// src/services/duplicateCheckService.js
// Step 6 — "Duplicate Check": IndicSBERT semantic similarity of the
// complaint text, combined with MongoDB 2dsphere geo-matching, checks
// whether this matches an existing open grievance.
// Step 7 — if a match is found, merge into the existing ticket and raise
// its priority instead of creating a new complaint.
//
// This is a two-stage filter, cheapest/coarsest check first:
//   1. Geospatial candidate search ($geoWithin + $centerSphere) narrows the
//      whole collection down to "things reported near here recently".
//   2. Semantic similarity re-ranks/filters that small candidate set.
// Doing it in this order is what makes the check cheap enough to run
// synchronously on the citizen-facing submit path — the geo index does
// the heavy lifting before any (comparatively expensive) similarity
// scoring happens.

import Grievance from '../models/Grievance.js';
import env from '../config/env.js';

const EARTH_RADIUS_METERS = 6378100;

// Grievances in these statuses are still "open" and worth deduping
// against. A RESOLVED or already-ESCALATED-and-closed ticket shouldn't
// silently absorb a fresh report of a recurring problem.
const OPEN_STATUSES = ['LODGED', 'ASSIGNED', 'IN_PROGRESS'];

/**
 * Stage 1 — geospatial candidate search.
 * Finds open grievances in the same department, within DUPLICATE_RADIUS_METERS
 * of the new report's coordinates, reported within the lookback window.
 *
 * @param {{ lng: number, lat: number }} coords
 * @param {import('mongoose').Types.ObjectId} departmentId
 */
async function findGeoCandidates(coords, departmentId) {
  const radiusRadians = env.duplicateCheck.radiusMeters / EARTH_RADIUS_METERS;
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - env.duplicateCheck.lookbackDays);

  return Grievance.find({
    department: departmentId,
    status: { $in: OPEN_STATUSES },
    createdAt: { $gte: lookbackDate },
    location: {
      // $geoWithin + $centerSphere is used over $near here because we don't
      // need distance-sorting for this step, just a candidate set — and
      // $geoWithin has no restriction on being the only geo clause in the
      // query (unlike $near), keeping this composable with the other filters.
      $geoWithin: {
        $centerSphere: [[coords.lng, coords.lat], radiusRadians],
      },
    },
  })
    .select('complaintId originalText translatedText priorityScore duplicateCount mergedTickets location cpgramsSync')
    .limit(25); // candidate cap keeps stage 2 cheap even in a dense area
}

/**
 * Stage 2 — lightweight token-overlap similarity. This deliberately avoids
 * external embedding services and local transformer models.
 *
 * @returns {number} similarity score in [0, 1]
 */
export function semanticSimilarity(textA, textB) {
  const tokenize = (s) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .split(/\s+/)
        .filter(Boolean)
    );

  const setA = tokenize(textA || '');
  const setB = tokenize(textB || '');
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Full Step 6 check: runs the geo candidate search, then scores each
 * candidate semantically, and returns the best match above threshold
 * (or null if this is a genuinely new complaint).
 *
 * @param {{
 *   text: string,
 *   coords: { lng: number, lat: number },
 *   departmentId: import('mongoose').Types.ObjectId
 * }} newReport
 * @returns {Promise<{ grievance: object, similarityScore: number } | null>}
 */
export async function findDuplicate(newReport) {
  const candidates = await findGeoCandidates(newReport.coords, newReport.departmentId);
  if (candidates.length === 0) return null;

  let best = null;
  for (const candidate of candidates) {
    const candidateText = candidate.translatedText || candidate.originalText;
    const score = semanticSimilarity(newReport.text, candidateText);
    if (score >= env.duplicateCheck.similarityThreshold && (!best || score > best.similarityScore)) {
      best = { grievance: candidate, similarityScore: score };
    }
  }
  return best;
}

/**
 * Step 7 (duplicate branch): merges a new report into an existing open
 * grievance instead of creating a second Grievance document. Raises the
 * existing ticket's priority score so repeated reports of the same issue
 * surface higher in the staff queue.
 *
 * @param {import('mongoose').Document} existingGrievance
 * @param {{ citizenId, text, similarityScore }} newReport
 */
export async function mergeIntoExisting(existingGrievance, newReport) {
  existingGrievance.duplicateCount += 1;
  existingGrievance.mergedTickets.push({
    reportedAt: new Date(),
    citizen: newReport.citizenId,
    originalText: newReport.text,
    similarityScore: newReport.similarityScore,
  });

  // Each additional confirmed report of the same issue is real-world
  // evidence it matters more, not less — bump priority, capped at 100.
  // Every third duplicate escalates urgency a notch as a simple, explicit
  // rule (swap for a tuned formula once real volume data exists).
  const PRIORITY_BUMP_PER_DUPLICATE = 5;
  existingGrievance.priorityScore = Math.min(
    100,
    existingGrievance.priorityScore + PRIORITY_BUMP_PER_DUPLICATE
  );
  if (existingGrievance.duplicateCount % 3 === 0) {
    existingGrievance.isUrgentAlert = true;
  }

  await existingGrievance.save();
  return existingGrievance;
}

export default { findDuplicate, mergeIntoExisting, semanticSimilarity };
