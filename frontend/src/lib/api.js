// src/lib/api.js
// Thin fetch wrapper around the Nagrik Sahayak backend's public citizen
// API (src/routes/citizenRoutes.js on the backend). Every function here
// maps 1:1 to one backend endpoint — no business logic lives here, just
// request/response shaping + a consistent error type.

import { getAuth, clearAuth } from "./storage";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://sih-backend-01.onrender.com/api";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let res;
  const token = getAuth()?.token;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (networkErr) {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
      networkErr
    );
  }

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    if (res.status === 401 && token) clearAuth(); // expired/invalid -> ask to verify again
    throw new ApiError(
      body?.message || `Request failed with status ${res.status}`,
      res.status,
      body
    );
  }

  return body;
}

/** Send a 6-digit code to the phone. `turnstileToken` is required when the server has CAPTCHA enabled. */
export function requestOtp({ phone, turnstileToken }) {
  return request("/citizen/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ phone, turnstileToken }),
  });
}

/** Verify the code; returns { token, citizen }. Caller stores it with setAuth(). */
export function verifyOtp({ phone, code }) {
  return request("/citizen/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

/**
 * Steps 2-4: classify raw complaint text and find out whether a
 * clarifying question (e.g. missing location) is needed before the
 * citizen can confirm & submit.
 */
export function intakeGrievance({ text, language = "en", location }) {
  return request("/citizen/intake", {
    method: "POST",
    body: JSON.stringify({ text, language, location }),
  });
}

/**
 * Step 2: voice capture. Uploads a recorded audio blob to the backend,
 * which runs Bhashini ASR then the same Step 3-4 classification as
 * intakeGrievance above. Returns the same { complete, ... } shape plus a
 * `transcript` field so the UI can show what was heard.
 */
export async function intakeVoiceGrievance({ audioBlob, filename = "voice-note.webm", language = "hi", location }) {
  const formData = new FormData();
  formData.append("audio", audioBlob, filename);
  formData.append("language", language);
  if (location?.lat != null) formData.append("location.lat", String(location.lat));
  if (location?.lng != null) formData.append("location.lng", String(location.lng));

  let res;
  try {
    // Deliberately not using the shared `request()` helper — it always
    // sets Content-Type: application/json, which breaks multipart
    // boundary handling. The browser sets the correct multipart
    // Content-Type + boundary automatically when body is a FormData.
    const token = getAuth()?.token;
    res = await fetch(`${API_BASE_URL}/citizen/intake/voice`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch (networkErr) {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0, networkErr);
  }

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    if (res.status === 401) clearAuth();
    throw new ApiError(body?.message || `Request failed with status ${res.status}`, res.status, body);
  }
  return body;
}

/**
 * Steps 5-10: citizen-confirmed submission. Runs dedup, generates the
 * complaint ID (or merges into an existing ticket), routes to a
 * department, and starts the SLA clock.
 */
export function submitGrievance(payload) {
  return request("/citizen/grievances", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Tracking lookup by complaint ID — citizen-safe fields only. */
export function trackGrievance(complaintId) {
  return request(`/citizen/grievances/${encodeURIComponent(complaintId)}`, {
    method: "GET",
  });
}

/** Step 14: resolution feedback (rating 1-5 + optional comment). */
export function submitFeedback(complaintId, { rating, comment, confirmedResolved }) {
  return request(
    `/citizen/grievances/${encodeURIComponent(complaintId)}/feedback`,
    {
      method: "POST",
      body: JSON.stringify({ rating, comment, confirmedResolved }),
    }
  );
}

export default {
  requestOtp,
  verifyOtp,
  intakeGrievance,
  submitGrievance,
  trackGrievance,
  submitFeedback,
};
