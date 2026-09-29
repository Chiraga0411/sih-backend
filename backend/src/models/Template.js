// src/models/Template.js
// Notes section: "all citizen-facing message text ... must exist as a
// pre-written, human-verified template per language and per scenario."
//
// The static defaults live in /src/templates/messageCatalog.js (the
// "/templates (pre-translated message catalog)" folder called for in the
// architecture). This model lets those human-verified templates be
// persisted/edited/versioned in MongoDB by admins without a code deploy,
// while the catalog file remains the seed source and the offline fallback
// if the DB has no override for a given key+language yet.

import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema(
  {
    // e.g. 'CLARIFY_LOCATION', 'STATUS_ASSIGNED', 'COMPLAINT_LODGED'
    key: { type: String, required: true, trim: true },
    language: { type: String, required: true, lowercase: true, trim: true }, // ISO code: en, hi, ta, bn...
    channel: {
      type: String,
      enum: ['WHATSAPP', 'SMS', 'CHAT', 'IVR'],
      default: 'WHATSAPP',
    },
    // Uses {{placeholder}} tokens filled in by notificationService.
    text: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    // Notes section: "light human-review sample early on" — track whether
    // a human has verified this template before it goes live.
    verifiedBy: { type: String, default: null },
  },
  { timestamps: true }
);

templateSchema.index({ key: 1, language: 1, channel: 1 }, { unique: true });

export const Template = mongoose.model('Template', templateSchema);
export default Template;
