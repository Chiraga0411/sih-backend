// src/middlewares/authMiddleware.js
// Section 4: "Every subsequent admin API request includes the JWT; backend
// middleware validates the token ... before returning data." This
// middleware only proves "who is this staff member" — permission checking
// ("is their role allowed to do X") is roleMiddleware.js's job, kept
// separate so routes can compose auth + role checks independently.

import jwt from 'jsonwebtoken';
import Staff from '../models/Staff.js';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Not authenticated: missing Bearer token', 401);
  }

  const token = header.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw new AppError('Not authenticated: invalid or expired token', 401);
  }

  // Citizen OTP tokens are signed with the same secret; never accept one here.
  if (payload.typ === 'citizen') {
    throw new AppError('Not authenticated: invalid token type', 401);
  }

  const staff = await Staff.findById(payload.sub);
  if (!staff || !staff.isActive) {
    throw new AppError('Not authenticated: staff account not found or deactivated', 401);
  }

  // Attach the authenticated staff member (and a lightweight copy of the
  // token's role claim) to the request for roleMiddleware + controllers.
  req.staff = staff;
  next();
});

export default protect;
