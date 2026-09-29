// src/lib/adminApi.js
// Client for the JWT-protected staff/admin surface (src/routes/adminRoutes.js
// and analyticsRoutes.js on the backend) — deliberately kept separate from
// lib/api.js, which only talks to the public, unauthenticated citizen API.

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://sih-backend-01.onrender.com/api";

const TOKEN_KEY = "nagrik_admin_token";
const STAFF_KEY = "nagrik_admin_staff";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredStaff() {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(token, staff) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STAFF_KEY);
}

async function request(path, options = {}) {
  const token = getToken();

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
  } catch (networkErr) {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
      networkErr
    );
  }

  if (res.status === 401) {
    clearSession();
  }

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    throw new ApiError(
      body?.message || `Request failed with status ${res.status}`,
      res.status,
      body
    );
  }

  return body;
}

// ---- auth ----
export function login(email, password) {
  return request("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function me() {
  return request("/admin/me");
}

// ---- grievance queue (Step 11) ----
export function listGrievances({ status, department, needsReview, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (needsReview) params.set("needsReview", "true");
  if (department) params.set("department", department);
  params.set("page", page);
  params.set("limit", limit);
  return request(`/admin/grievances?${params.toString()}`);
}

export function getGrievance(id) {
  return request(`/admin/grievances/${encodeURIComponent(id)}`);
}

export function assignGrievance(id, staffId) {
  return request(`/admin/grievances/${encodeURIComponent(id)}/assign`, {
    method: "PATCH",
    body: JSON.stringify(staffId ? { staffId } : {}),
  });
}

export function updateStatus(id, status, note) {
  return request(`/admin/grievances/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}

// ---- moderation: trust score + phone blocklist ----
/** reason: SPAM | INVALID | DUPLICATE. blockPhone is admin-only. */
export function flagGrievance(id, { reason, blockPhone = false, note }) {
  return request(`/admin/grievances/${encodeURIComponent(id)}/flag`, {
    method: "PATCH",
    body: JSON.stringify({ reason, blockPhone, note }),
  });
}

export function approveGrievance(id, note) {
  return request(`/admin/grievances/${encodeURIComponent(id)}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

export function listBlocklist() {
  return request("/admin/blocklist");
}

export function blockPhone({ phone, reason, days }) {
  return request("/admin/blocklist", {
    method: "POST",
    body: JSON.stringify({ phone, reason, days: days || undefined }),
  });
}

export function unblockPhone(phone) {
  return request(`/admin/blocklist/${encodeURIComponent(phone)}`, { method: "DELETE" });
}

// ---- analytics (Step 15) ----
export function resolutionMetrics() {
  return request("/analytics/resolution-metrics");
}
export function volumeByDepartment() {
  return request("/analytics/volume-by-department");
}
export function slaCompliance() {
  return request("/analytics/sla-compliance");
}

export default {
  login,
  me,
  listGrievances,
  getGrievance,
  assignGrievance,
  updateStatus,
  flagGrievance,
  approveGrievance,
  listBlocklist,
  blockPhone,
  unblockPhone,
  resolutionMetrics,
  volumeByDepartment,
  slaCompliance,
  getToken,
  getStoredStaff,
  setSession,
  clearSession,
};
