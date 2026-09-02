// src/utils/idGenerator.js
// Step 7 — "Complaint ID Generated": a collision-proof UUID v4 is generated
// as the complaint ID and sent back to the citizen instantly.
//
// We generate a full UUID v4 (the actual collision-proof identifier, stored
// as `rawUuid`) and derive a short, human-readable, citizen-facing ID from
// it in the NS-YYYY-MMDD-XXXXXX format called out in the spec. The short
// form is what gets read out over IVR / shown in WhatsApp, so it needs to
// be short — but its entropy comes straight from the UUID, and uniqueness
// is additionally enforced by a unique index on Grievance.complaintId plus
// the retry loop below.

import { v4 as uuidv4 } from 'uuid';

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Generates one candidate complaint ID + its backing UUID.
 * Does NOT check the database — callers combine this with a uniqueness
 * check (see generateUniqueComplaintId).
 */
export function generateComplaintId(date = new Date()) {
  const rawUuid = uuidv4();
  const shortCode = rawUuid.replace(/-/g, '').slice(0, 6).toUpperCase();
  const yyyy = date.getFullYear();
  const mmdd = `${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return {
    complaintId: `NS-${yyyy}-${mmdd}-${shortCode}`,
    rawUuid,
  };
}

/**
 * Generates a complaint ID and retries (extremely rare, since the short
 * code carries 24 bits of UUID entropy) if it collides with an existing
 * document. `existsCheck` is injected so this util has no direct Mongoose
 * dependency and stays easily testable.
 *
 * @param {(complaintId: string) => Promise<boolean>} existsCheck
 */
export async function generateUniqueComplaintId(existsCheck, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateComplaintId();
    // eslint-disable-next-line no-await-in-loop
    const taken = await existsCheck(candidate.complaintId);
    if (!taken) return candidate;
  }
  throw new Error('Failed to generate a unique complaint ID after multiple attempts');
}

export default generateUniqueComplaintId;
