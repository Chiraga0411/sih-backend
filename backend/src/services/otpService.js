// src/services/otpService.js
// Phone OTP for the web/app channels (WhatsApp already proves the number).
// The code is generated here and only an HMAC is stored. Delivery is
// pluggable: OTP_SENDER=console (dev/demo, no SMS cost) | twilio | msg91.
// Twilio Verify is a fine alternative; this keeps everything in our own DB.

import crypto from 'node:crypto';
import axios from 'axios';
import twilio from 'twilio';
import Otp from '../models/Otp.js';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

const RESEND_COOLDOWN_MS = 30_000;

const hashCode = (phone, code) =>
  crypto.createHmac('sha256', env.jwtSecret).update(`${phone}:${code}`).digest('hex');

async function sendSms(phone, code) {
  const text = `${code} is your Nagrik Sahayak verification code. Valid for ${env.otp.ttlMinutes} minutes. Do not share it.`;

  switch (env.otp.sender) {
    case 'twilio': {
      const client = twilio(env.twilio.accountSid, env.twilio.authToken);
      await client.messages.create({ from: env.twilio.smsFrom, to: phone, body: text });
      return;
    }
    case 'msg91': {
      // Verify against MSG91's current OTP API + your DLT-registered template.
      await axios.post('https://control.msg91.com/api/v5/otp', null, {
        params: {
          template_id: env.otp.msg91.templateId,
          mobile: phone.replace('+', ''),
          authkey: env.otp.msg91.authKey,
          otp: code,
        },
        timeout: 8000,
      });
      return;
    }
    default:
      console.log(`[otp:SIMULATE] ${phone} -> ${code}`);
  }
}

export async function requestOtp(phone) {
  const last = await Otp.findOne({ phone }).sort({ createdAt: -1 });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError('Please wait a few seconds before requesting another code.', 429);
  }

  await Otp.updateMany({ phone, consumed: false }, { $set: { consumed: true } }); // only the newest code works

  const code = String(crypto.randomInt(100000, 1000000));
  const row = await Otp.create({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(Date.now() + env.otp.ttlMinutes * 60_000),
  });

  try {
    await sendSms(phone, code);
  } catch (err) {
    await Otp.deleteOne({ _id: row._id });
    console.error('[otp] SMS send failed:', err.message);
    throw new AppError('Could not send the verification code. Please try again.', 502);
  }

  const exposeForDemo = env.otp.sender === 'console' && env.nodeEnv !== 'production';
  return { devOtp: exposeForDemo ? code : undefined };
}

export async function verifyOtp(phone, code) {
  const row = await Otp.findOneAndUpdate(
    { phone, consumed: false, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { sort: { createdAt: -1 }, new: true }
  );
  if (!row) throw new AppError('This code has expired. Please request a new one.', 401);
  if (row.attempts > env.otp.maxAttempts) {
    await Otp.updateOne({ _id: row._id }, { $set: { consumed: true } });
    throw new AppError('Too many wrong attempts. Please request a new code.', 429);
  }

  const expected = Buffer.from(row.codeHash);
  const given = Buffer.from(hashCode(phone, String(code)));
  if (!crypto.timingSafeEqual(expected, given)) throw new AppError('Incorrect code.', 401);

  await Otp.updateOne({ _id: row._id }, { $set: { consumed: true } });
  return true;
}

export default { requestOtp, verifyOtp };
