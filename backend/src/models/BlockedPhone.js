// src/models/BlockedPhone.js
// Phone blocklist. expiresAt = null means permanent (until an admin removes it).

import mongoose from 'mongoose';

const blockedPhoneSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    reason: { type: String, required: true, trim: true },
    blockedBy: { type: String }, // staff id
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const BlockedPhone = mongoose.model('BlockedPhone', blockedPhoneSchema);
export default BlockedPhone;
