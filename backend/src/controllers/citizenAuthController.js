// src/controllers/citizenAuthController.js
// Phone OTP login for the web/app channel. Still no passwords or profiles —
// verifying just marks the Citizen doc as phone-verified and returns a token.

import Citizen from '../models/Citizen.js';
import * as otpService from '../services/otpService.js';
import { applyTrustEvent, isPhoneBlocked } from '../services/trustService.js';
import { signCitizenToken } from '../middlewares/citizenAuth.js';
import { normalizePhone } from '../utils/phone.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import env from '../config/env.js';

export const requestOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) throw new AppError('Enter a valid 10-digit Indian mobile number.', 400);
  if (await isPhoneBlocked(phone)) {
    throw new AppError('This number cannot be used right now. Please contact the helpline.', 403);
  }

  const { devOtp } = await otpService.requestOtp(phone);
  res.status(200).json({ success: true, phone, expiresInMinutes: env.otp.ttlMinutes, ...(devOtp ? { devOtp } : {}) });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const code = String(req.body.code || '').trim();
  if (!phone || !/^\d{6}$/.test(code)) throw new AppError('Enter the 6-digit code.', 400);

  await otpService.verifyOtp(phone, code);

  let citizen = await Citizen.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone, preferredChannel: 'WEB' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (!citizen.phoneVerifiedAt) {
    citizen = await Citizen.findByIdAndUpdate(citizen._id, { $set: { phoneVerifiedAt: new Date() } }, { new: true });
    citizen = (await applyTrustEvent(citizen._id, 'phone_verified')) || citizen;
  }

  res.status(200).json({
    success: true,
    token: signCitizenToken(citizen),
    citizen: { phone: citizen.phone, name: citizen.name || '' },
  });
});

export default { requestOtp, verifyOtp };
