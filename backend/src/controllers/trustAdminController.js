// src/controllers/trustAdminController.js
// Staff actions that feed trustScore and the phone blocklist.

import Grievance from '../models/Grievance.js';
import BlockedPhone from '../models/BlockedPhone.js';
import { applyTrustEvent } from '../services/trustService.js';
import { normalizePhone } from '../utils/phone.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

const REASON_TO_EVENT = { SPAM: 'flagged_spam', INVALID: 'rejected_invalid', DUPLICATE: 'duplicate' };

async function loadModeratable(req) {
  const grievance = await Grievance.findById(req.params.id).populate('citizen');
  if (!grievance) throw new AppError('Grievance not found', 404);
  if (req.staff.role !== 'admin' && String(grievance.department) !== String(req.staff.department)) {
    throw new AppError('Forbidden: this grievance belongs to a different department', 403);
  }
  if (grievance.moderation?.reason) {
    throw new AppError(`Already reviewed (${grievance.moderation.reason}).`, 409);
  }
  return grievance;
}

/** PATCH /api/admin/grievances/:id/flag  { reason: SPAM|INVALID|DUPLICATE, blockPhone?: boolean, note?: string } */
export const flagGrievance = asyncHandler(async (req, res) => {
  const event = REASON_TO_EVENT[req.body.reason];
  if (!event) throw new AppError('reason must be one of SPAM, INVALID, DUPLICATE', 400);
  if (req.body.blockPhone && req.staff.role !== 'admin') {
    throw new AppError('Only an admin can block a phone number', 403);
  }

  const grievance = await loadModeratable(req);

  const citizen = await applyTrustEvent(grievance.citizen._id, event);
  grievance.needsReview = false;
  grievance.moderation = { reason: req.body.reason, by: String(req.staff._id), at: new Date(), note: req.body.note };
  await grievance.save();

  if (req.body.blockPhone) {
    await BlockedPhone.findOneAndUpdate(
      { phone: grievance.citizen.phone },
      { phone: grievance.citizen.phone, reason: req.body.note || req.body.reason, blockedBy: String(req.staff._id), expiresAt: null },
      { upsert: true }
    );
  }

  res.status(200).json({ success: true, trustScore: citizen.trustScore, blocked: Boolean(req.body.blockPhone) });
});

/** PATCH /api/admin/grievances/:id/approve — reviewed and legitimate: clears needsReview, no score change. */
export const approveGrievance = asyncHandler(async (req, res) => {
  const grievance = await loadModeratable(req);
  grievance.needsReview = false;
  grievance.moderation = { reason: 'APPROVED', by: String(req.staff._id), at: new Date(), note: req.body?.note };
  await grievance.save();
  res.status(200).json({ success: true });
});

/** GET /api/admin/blocklist */
export const listBlocklist = asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, items: await BlockedPhone.find().sort({ createdAt: -1 }).limit(200) });
});

/** POST /api/admin/blocklist { phone, reason, days? }  (days omitted = permanent) */
export const blockPhone = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone || !req.body.reason) throw new AppError('A valid phone and a reason are required', 400);
  const expiresAt = req.body.days ? new Date(Date.now() + Number(req.body.days) * 86_400_000) : null;
  const item = await BlockedPhone.findOneAndUpdate(
    { phone },
    { phone, reason: req.body.reason, blockedBy: String(req.staff._id), expiresAt },
    { upsert: true, new: true }
  );
  res.status(201).json({ success: true, item });
});

/** DELETE /api/admin/blocklist/:phone */
export const unblockPhone = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.params.phone);
  await BlockedPhone.deleteOne({ phone });
  res.status(200).json({ success: true });
});

export default { flagGrievance, approveGrievance, listBlocklist, blockPhone, unblockPhone };
