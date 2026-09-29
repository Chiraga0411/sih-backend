// src/lib/storage.js
// Citizens never have accounts (Section 4 of the workflow doc), so there's
// no backend endpoint to "log in" and list a citizen's own complaints.
// Instead we keep two small things in this browser's localStorage:
//   1. a lightweight profile (name/phone/language) used to fill in
//      `citizen.phone` on every submission, and
//   2. the list of complaint IDs this device has ever submitted, which
//      "My complaints" resolves against GET /api/citizen/grievances/:id.

const PROFILE_KEY = "nagrik_profile";
const COMPLAINT_IDS_KEY = "nagrik_my_complaint_ids";

const AUTH_KEY = "nagrik_auth";

const DEFAULT_PROFILE = {
  name: "",
  phone: "",
  location: "",
  language: "Hindi",
};

export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(partialProfile) {
  const next = { ...getProfile(), ...partialProfile };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function getMyComplaintIds() {
  try {
    const raw = localStorage.getItem(COMPLAINT_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function addMyComplaintId(complaintId) {
  if (!complaintId) return;
  const ids = getMyComplaintIds();
  if (!ids.includes(complaintId)) {
    // newest first
    localStorage.setItem(
      COMPLAINT_IDS_KEY,
      JSON.stringify([complaintId, ...ids])
    );
  }
}

// Phone-verification token (issued by POST /citizen/auth/verify-otp).
// Not an account: it only proves this browser controls `phone`.
export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    const auth = raw ? JSON.parse(raw) : null;
    if (!auth?.token || !auth?.phone) return null;
    // Decode the JWT expiry (payload only; the server is the real authority).
    const payload = JSON.parse(atob(auth.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return auth;
  } catch {
    return null;
  }
}

export function setAuth({ token, phone }) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, phone }));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

// Digits-only compare so "98765 43210" matches "+919876543210".
const last10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

export function isVerifiedFor(phone) {
  const auth = getAuth();
  return Boolean(auth && last10(auth.phone) === last10(phone) && last10(phone).length === 10);
}

export default {
  getAuth,
  setAuth,
  clearAuth,
  isVerifiedFor,
  getProfile,
  saveProfile,
  getMyComplaintIds,
  addMyComplaintId,
};
