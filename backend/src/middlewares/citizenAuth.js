// src/middlewares/citizenAuth.js
// Verifies the short-lived token issued after OTP verification. This is NOT
// an account: it only proves "this browser controls this phone number".
// (Staff tokens live in authMiddleware.js and are rejected here.)

import jwt from 'jsonwebtoken';
import Citizen from '../models/Citizen.js';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isPhoneBlocked } from '../services/trustService.js';

export function signCitizenToken(citizen) {
  return jwt.sign({ sub: citizen.id, typ: 'citizen' }, env.jwtSecret, { expiresIn: env.citizenJwtExpiresIn });
}

export const protectCitizen = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Please verify your phone number to continue.', 401);
  }

  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], env.jwtSecret);
  } catch {
    throw new AppError('Your verification has expired. Please verify your phone number again.', 401);
  }
  if (payload.typ !== 'citizen') throw new AppError('Invalid token type.', 401);

  const citizen = await Citizen.findById(payload.sub);
  if (!citizen || !citizen.phoneVerifiedAt) {
    throw new AppError('Please verify your phone number to continue.', 401);
  }
  if (await isPhoneBlocked(citizen.phone)) {
    throw new AppError('This number cannot use the service right now.', 403);
  }

  req.citizen = citizen;
  next();
});

export default protectCitizen;
