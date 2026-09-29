// src/lib/format.js
// Small shared formatters so every page renders backend enums
// (LODGED/ASSIGNED/IN_PROGRESS/RESOLVED/ESCALATED, urgency levels, ISO
// dates) the same way instead of re-implementing this per page.

const STATUS_LABELS = {
  LODGED: "Lodged",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  ESCALATED: "Escalated",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "Unknown";
}

export function formatDate(dateLike) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(dateLike) {
  if (!dateLike) return "—";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function priorityFromUrgency(urgencyLevel) {
  const map = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };
  return map[urgencyLevel] || "Medium";
}

export default { statusLabel, formatDate, formatDateTime, priorityFromUrgency };
