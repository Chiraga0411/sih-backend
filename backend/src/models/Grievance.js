// src/models/Grievance.js
// The central document of the whole system. Its shape mirrors the workflow
// end to end:
//   Phase A (intake/classification) -> classification + location fields
//   Phase B (dedup/routing/priority) -> complaintId, department, priority,
//                                        duplicateCount/mergedTickets, SLA
//   Phase C (resolution/escalation)  -> status, statusHistory, feedback
//
// Field-by-field comments below point back to the specific workflow step
// that populates or consumes that field.

import mongoose from 'mongoose';

const { Schema } = mongoose;

// --- Sub-schemas -----------------------------------------------------------

// GeoJSON Point — required shape for MongoDB 2dsphere geospatial queries.
// Populated from NER-extracted location (Step 3) or citizen-supplied
// coordinates, and consumed by duplicateCheckService's $near/$geoWithin
// query (Step 6).
const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      // [longitude, latitude] — GeoJSON order, NOT [lat, lng].
      type: [Number],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: 'coordinates must be an array of exactly [lng, lat]',
      },
    },
  },
  { _id: false }
);

// Step 3: IndicBERT-v2 classification + NER output, and Step 5's citizen
// confirmation of that output.
const classificationSchema = new Schema(
  {
    issueType: { type: String, trim: true }, // e.g. "pothole", "water leakage"
    confidence: { type: Number, min: 0, max: 1 }, // IndicBERT-v2 confidence score
    entities: {
      locationText: { type: String, trim: true }, // NER-extracted free-text location
      landmark: { type: String, trim: true },
    },
    sentiment: {
      type: String,
      enum: ['NEGATIVE', 'NEUTRAL', 'POSITIVE'],
      default: 'NEUTRAL',
    }, // feeds Step 9 priority triage
    // true once the citizen has confirmed/corrected the AI's detected
    // department & details (Step 5), false while still in clarification.
    citizenConfirmed: { type: Boolean, default: false },
  },
  { _id: false }
);

// Step 12: one entry per status transition, so both citizens and admin
// dashboard analytics (Step 15) can reconstruct a full timeline.
const statusHistoryEntrySchema = new Schema(
  {
    status: {
      type: String,
      enum: ['LODGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED'],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    // Staff ObjectId as a string, or a system actor label like
    // 'system:sla-tracker' for automated escalations (Step 13).
    updatedBy: { type: String, required: true },
    note: { type: String, trim: true },
  },
  { _id: false }
);

// Step 7 (duplicate branch): each merged report keeps a lightweight
// breadcrumb rather than becoming its own Grievance document.
const mergedTicketSchema = new Schema(
  {
    reportedAt: { type: Date, default: Date.now },
    citizen: { type: Schema.Types.ObjectId, ref: 'Citizen' },
    originalText: { type: String, trim: true },
    similarityScore: { type: Number, min: 0, max: 1 }, // IndicSBERT similarity that triggered the merge
  },
  { _id: false }
);

// Step 14: citizen resolution confirmation + rating.
const feedbackSchema = new Schema(
  {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true },
    submittedAt: { type: Date },
    citizenConfirmedResolved: { type: Boolean, default: false },
  },
  { _id: false }
);

// --- Main schema -------------------------------------------------------------

const grievanceSchema = new Schema(
  {
    // Step 7 — citizen-facing tracking ID, format NS-YYYY-MMDD-XXXXXX.
    complaintId: { type: String, required: true, unique: true, index: true },
    // The full UUID v4 backing complaintId — the actual "collision-proof"
    // identifier; see utils/idGenerator.js.
    rawUuid: { type: String, required: true, unique: true },

    citizen: { type: Schema.Types.ObjectId, ref: 'Citizen', required: true },

    // Step 1 — contact channel.
    channel: {
      type: String,
      enum: ['WHATSAPP', 'WEB', 'MOBILE_APP', 'IVR'],
      required: true,
    },
    language: { type: String, required: true, lowercase: true, trim: true },

    // Step 2 — raw citizen input. If voice, this is Bhashini ASR's
    // transcript, not the audio itself.
    originalText: { type: String, required: true, trim: true },
    // Step 3 — IndicTrans2 output, only populated when a common working
    // language is needed for a human reviewer/staff member.
    translatedText: { type: String, trim: true, default: null },

    classification: { type: classificationSchema, default: () => ({}) },

    // Step 8 — routing target. Nullable only transiently during Step
    // 3/4 classification; required by the time a Grievance is persisted
    // (persistence itself only happens after Step 6's dedup check passes).
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },

    location: { type: pointSchema, required: true },
    addressText: { type: String, trim: true }, // human-readable address, if provided/geocoded

    // Step 3/9 — status pipeline exactly as specified by the workflow.
    status: {
      type: String,
      enum: ['LODGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED'],
      default: 'LODGED',
      index: true,
    },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },

    // Step 9 — urgency/priority triage. urgencyLevel drives the SLA
    // multiplier (utils/slaCalculator.js); priorityScore is a finer-grained
    // 0-100 ranking used to sort the staff queue and gets boosted on
    // duplicate merges and escalation.
    urgencyLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    priorityScore: { type: Number, min: 0, max: 100, default: 50 },
    isUrgentAlert: { type: Boolean, default: false }, // Step 9: immediate admin alert fired

    // Step 6/7 — deduplication bookkeeping.
    duplicateCount: { type: Number, default: 0 },
    mergedTickets: { type: [mergedTicketSchema], default: [] },

    // Step 10 — SLA timer.
    slaTarget: { type: Date, required: true },
    slaBreached: { type: Boolean, default: false, index: true },

    // Section 4 — assigned during Step 11 by an authenticated staff member.
    assignedStaff: { type: Schema.Types.ObjectId, ref: 'Staff', default: null },

    // Step 13 — escalation bookkeeping. escalatedAt is reset on every escalation
    // (initial breach AND any later re-escalation), so slaTrackerJob's
    // re-escalation sweep can find tickets that have sat in ESCALATED status
    // past a further grace window without a fresh look. escalationCount lets
    // staff/analytics see "how many times has this bounced" at a glance,
    // rather than just a boolean escalated/not-escalated flag.
    escalationCount: { type: Number, default: 0 },
    escalatedAt: { type: Date, default: null },

    // Step 8 — CPGRAMS is the system of record; sync is strictly one-way
    // (Mongo -> CPGRAMS). We never read grievance state back from CPGRAMS.
    cpgramsSync: {
      status: {
        type: String,
        enum: ['PENDING', 'SYNCED', 'FAILED'],
        default: 'PENDING',
      },
      refId: { type: String, default: null },
      lastAttemptAt: { type: Date, default: null },
      error: { type: String, default: null },
    },

    resolvedAt: { type: Date, default: null },
    feedback: { type: feedbackSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// --- Indexes -----------------------------------------------------------------

// Step 6: the core of duplicateCheckService's geospatial half of the
// dedup check ($near / $geoWithin both require this).
grievanceSchema.index({ location: '2dsphere' });

// Step 15: analytics aggregations group/filter by these constantly.
grievanceSchema.index({ department: 1, status: 1, createdAt: -1 });

export const Grievance = mongoose.model('Grievance', grievanceSchema);
export default Grievance;
