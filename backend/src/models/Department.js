// src/models/Department.js
// Backs Step 8 (routing) and Section 4 (staff are each assigned to one
// department). slaHours feeds Step 10's SLA timer via slaCalculator.js.

import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    // Base SLA resolution window in hours for this department, before the
    // urgency multiplier from slaCalculator.js is applied.
    slaHours: { type: Number, required: true, default: 72, min: 1 },
    contactEmail: { type: String, trim: true, lowercase: true },
    // Keyword hints used by the aiService classification stub (Step 3) to
    // route free text to this department. Real deployment swaps this for
    // IndicBERT-v2's learned classification, but routing still resolves to
    // one of these Department documents.
    keywords: [{ type: String, lowercase: true, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Department = mongoose.model('Department', departmentSchema);
export default Department;
