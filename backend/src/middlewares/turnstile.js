// src/middlewares/turnstile.js
// Cloudflare Turnstile bot check. Skipped (with a one-time warning) when
// TURNSTILE_SECRET is not set, like the Twilio SIMULATE mode, so local dev
// and demos work with zero external accounts. Set it before going public.

import axios from 'axios';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

let warned = false;

export const verifyTurnstile = asyncHandler(async (req, _res, next) => {
  if (!env.turnstileSecret) {
    if (!warned) {
      console.warn('[turnstile] TURNSTILE_SECRET not set — CAPTCHA check is DISABLED.');
      warned = true;
    }
    return next();
  }

  const token = req.body?.turnstileToken;
  if (!token) throw new AppError('Please complete the CAPTCHA check.', 400);

  let ok = false;
  try {
    const { data } = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      new URLSearchParams({ secret: env.turnstileSecret, response: token, remoteip: req.ip || '' }),
      { timeout: 8000 }
    );
    ok = data?.success === true;
  } catch (err) {
    console.error('[turnstile] verification request failed:', err.message);
    throw new AppError('CAPTCHA check is unavailable. Please try again.', 503);
  }
  if (!ok) throw new AppError('CAPTCHA check failed. Please try again.', 400);
  return next();
});

export default verifyTurnstile;
