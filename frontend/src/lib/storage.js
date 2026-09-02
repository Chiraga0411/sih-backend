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

export default {
  getProfile,
  saveProfile,
  getMyComplaintIds,
  addMyComplaintId,
};
