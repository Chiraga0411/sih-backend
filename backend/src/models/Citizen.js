// src/models/Citizen.js
// Step 1: citizens contact via WhatsApp/web/app/IVR with "no login or app
// download required." Section 4 is explicit that "citizens never have
// accounts" — so this model intentionally has NO password/auth fields. It
// exists only to de-duplicate identity across multiple grievances from the
// same phone number and to know where to deliver templated status updates.

import mongoose from 'mongoose';

const citizenSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, trim: true },
    preferredLanguage: { type: String, default: 'en', lowercase: true, trim: true },
    preferredChannel: {
      type: String,
      enum: ['WHATSAPP', 'WEB', 'MOBILE_APP', 'IVR'],
      default: 'WHATSAPP',
    },

    // Step 1/4 — bridges multi-turn conversational intake on stateless
    // channels (WhatsApp/IVR webhooks, one inbound message at a time, no
    // session). Holds the classified-but-not-yet-confirmed draft between
    // "here's my complaint" and "here's the missing location/detail" turns.
    // Cleared once submitGrievance() runs (see routes/webhookRoutes.js).
    pendingIntake: {
      text: { type: String, trim: true, default: null },
      language: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export const Citizen = mongoose.model('Citizen', citizenSchema);
export default Citizen;
