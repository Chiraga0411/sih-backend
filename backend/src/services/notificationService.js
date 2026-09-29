// src/services/notificationService.js
// Step 12 — "Real-Time Status Updates": at each status change, a
// pre-translated message template is filled with the complaint's current
// details and delivered via WhatsApp/SMS (Twilio, with retry logic).
// "Messages are not AI-generated — a fixed, human-verified template per
// language per status."
//
// Delivery runs in SIMULATE mode (logs instead of calling Twilio) whenever
// Twilio credentials aren't configured in env — see .env.example — so the
// whole citizen-facing flow is runnable and demoable with zero external
// accounts. Swap sendViaTwilio's body for the real SDK call to go live.

import twilio from 'twilio';
import Template from '../models/Template.js';
import { getCatalogTemplate } from '../templates/messageCatalog.js';
import env from '../config/env.js';

// Lazily constructed so the module loads fine (and SIMULATE mode still
// works) even when Twilio credentials aren't configured.
let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(env.twilio.accountSid, env.twilio.authToken);
  }
  return twilioClient;
}

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

/**
 * Fills {{placeholder}} tokens in a template string with values from data.
 */
export function renderTemplate(templateText, data = {}) {
  return templateText.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => (key in data ? String(data[key]) : `{{${key}}}`));
}

/**
 * Resolves the best available template for (key, language, channel):
 * DB override first (admin-edited, human-verified), static catalog
 * fallback second, so a send never silently fails for lack of a template.
 */
async function resolveTemplate(key, language, channel) {
  const dbTemplate = await Template.findOne({ key, language, channel, isActive: true }).lean();
  if (dbTemplate) return dbTemplate.text;

  const catalogText = getCatalogTemplate(key, language);
  if (catalogText) return catalogText;

  throw new Error(`No template found for key="${key}" language="${language}" (and no English fallback)`);
}

/**
 * STUB delivery call. In simulate mode (no Twilio creds), this just logs —
 * which is enough to prove the dispatch pipeline end-to-end in local/dev.
 * TODO(integration): replace the simulate branch's else-case with:
 *   const twilioClient = twilio(env.twilio.accountSid, env.twilio.authToken);
 *   await twilioClient.messages.create({ from, to, body: message });
 */
async function sendViaTwilio({ to, channel, message }) {
  const isSimulated = !env.twilio.accountSid || !env.twilio.authToken;
  if (isSimulated) {
    console.log(`[notificationService:SIMULATE] -> ${channel} ${to}: ${message}`);
    return { simulated: true };
  }

  const from = channel === 'WHATSAPP' ? env.twilio.whatsappFrom : env.twilio.smsFrom;
  if (!from) {
    throw new Error(`Twilio credentials are set but TWILIO_${channel}_FROM is missing`);
  }

  const toAddress = channel === 'WHATSAPP' ? `whatsapp:${to}` : to;
  const fromAddress = channel === 'WHATSAPP' ? `whatsapp:${from}` : from;

  const result = await getTwilioClient().messages.create({ from: fromAddress, to: toAddress, body: message });
  return { simulated: false, sid: result.sid, status: result.status };
}

/**
 * Sends one attempt with exponential-backoff retry, per Step 12's
 * "Twilio, with retry logic" requirement.
 */
async function sendWithRetry(payload) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await sendViaTwilio(payload);
    } catch (err) {
      lastError = err;
      console.warn(`[notificationService] send attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Public entry point used by controllers/jobs on every status transition.
 *
 * @param {{ phone: string, preferredChannel?: string }} citizen
 * @param {string} templateKey - e.g. 'STATUS_ASSIGNED', 'COMPLAINT_LODGED'
 * @param {object} data - placeholders for the template, e.g. { complaintId, department }
 * @param {string} language - ISO language code
 */
export async function sendTemplatedMessage(citizen, templateKey, data, language = 'en') {
  const channel = citizen.preferredChannel === 'WEB' || citizen.preferredChannel === 'MOBILE_APP' ? 'SMS' : 'WHATSAPP';
  const templateText = await resolveTemplate(templateKey, language, channel);
  const message = renderTemplate(templateText, data);

  try {
    const result = await sendWithRetry({ to: citizen.phone, channel, message });
    return { delivered: true, message, ...result };
  } catch (err) {
    // A failed notification should never crash the request that triggered
    // it (e.g. a status update by staff) — log and let the caller decide
    // whether to surface a warning.
    console.error(`[notificationService] gave up after ${MAX_ATTEMPTS} attempts: ${err.message}`);
    return { delivered: false, message, error: err.message };
  }
}

export default { sendTemplatedMessage, renderTemplate };
