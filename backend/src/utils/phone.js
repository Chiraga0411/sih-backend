// src/utils/phone.js
// One canonical phone format (E.164, India) so the same person on WhatsApp
// ("+919876543210") and on the web app (typed "98765 43210") resolves to ONE
// Citizen document, one trustScore, and one blocklist entry.

export function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits[2])) return `+${digits}`;
  return null; // not a valid Indian mobile number
}

export default { normalizePhone };
