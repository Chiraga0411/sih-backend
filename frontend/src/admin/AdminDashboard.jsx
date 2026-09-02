import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AdminLayout from "./AdminLayout";
import {
  listGrievances,
  assignGrievance,
  updateStatus,
  getStoredStaff,
  ApiError,
} from "../lib/adminApi";
import { statusLabel, formatDate } from "../lib/format";

const STATUS_OPTIONS = [
  "",
  "LODGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "ESCALATED",
];

const NEXT_STATUS = {
  ASSIGNED: "IN_PROGRESS",
  IN_PROGRESS: "RESOLVED",
  ESCALATED: "IN_PROGRESS",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const staff = getStoredStaff();

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null);

  function load() {
    setLoading(true);
    setError("");
    listGrievances({ status: status || undefined, page })
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load queue.")
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, page]);

  async function handleAssignToSelf(id) {
    setActingId(id);
    try {
      await assignGrievance(id);
      load();
    } catch (err) {
      setError(err.message || "Could not assign this complaint.");
    } finally {
      setActingId(null);
    }
  }

  async function handleAdvanceStatus(id, current) {
    const next = NEXT_STATUS[current];
    if (!next) return;
    setActingId(id);
    try {
      await updateStatus(id, next);
      load();
    } catch (err) {
      setError(err.message || "Could not update status.");
    } finally {
      setActingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / (data.limit || 20)));

  return (
    <AdminLayout>
      <div className="min-h-[70px] sm:h-[78px] bg-white border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-8 py-4 sm:py-0">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[#172033]">
            Complaints queue
          </h2>
          <p className="text-[14px] text-gray-400 mt-0.5">
            {staff?.role === "department_staff"
              ? "Scoped to your department"
              : "All departments"}
          </p>
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 rounded-lg border border-[#e1e4e7] text-[15px] outline-none cursor-pointer self-start sm:self-auto"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s ? statusLabel(s) : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        {error && (
          <p className="mb-4 text-[15px] font-semibold text-[#c94b4b]">
            {error}
          </p>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {/* Column header row - table view only, lg and up */}
          <div className="hidden lg:grid grid-cols-[1.2fr_1fr_1fr_0.8fr_1fr_1.2fr] px-6 py-3 border-b border-gray-100 bg-[#fafbfc]">
            {["Complaint", "Department", "Filed", "Priority", "Status", "Actions"].map(
              (h) => (
                <p
                  key={h}
                  className="text-[13px] font-bold tracking-[0.1em] text-gray-400"
                >
                  {h.toUpperCase()}
                </p>
              )
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-[16px] text-gray-400">
              <Loader2 size={15} className="animate-spin" /> Loading…
            </div>
          )}

          {!loading && data.items.length === 0 && (
            <p className="text-center py-10 text-[16px] text-gray-400">
              No complaints match this filter.
            </p>
          )}

          {!loading &&
            data.items.map((g) => (
              <div
                key={g._id}
                className="flex flex-col gap-3 lg:grid lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_1fr_1.2fr] lg:gap-0 px-4 sm:px-6 py-4 border-b border-gray-50 last:border-b-0 lg:items-center hover:bg-[#fafbfc]"
              >
                <div className="flex items-start justify-between gap-2 lg:contents">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/grievances/${g._id}`)}
                    className="text-left cursor-pointer min-w-0"
                  >
                    <p className="text-[15px] font-bold text-[#273c55]">
                      {g.complaintId}
                    </p>
                    <p className="text-[13px] text-gray-400 mt-0.5 line-clamp-1">
                      {g.text}
                    </p>
                  </button>
                  {/* Status shown inline with the title below lg */}
                  <span className="lg:hidden shrink-0 inline-flex w-fit px-2.5 py-1 rounded-full bg-[#fff1d4] text-[#b7791b] text-[13px] font-bold">
                    {statusLabel(g.status)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[14px] text-gray-600 lg:contents">
                  <p>
                    <span className="lg:hidden font-bold text-gray-400 mr-1">Dept:</span>
                    {g.department?.name || "—"}
                  </p>
                  <p>
                    <span className="lg:hidden font-bold text-gray-400 mr-1">Filed:</span>
                    {formatDate(g.createdAt)}
                  </p>
                  <p>
                    <span className="lg:hidden font-bold text-gray-400 mr-1">Priority:</span>
                    {g.priorityScore ?? "—"}
                  </p>
                </div>

                <span className="hidden lg:inline-flex w-fit px-2.5 py-1 rounded-full bg-[#fff1d4] text-[#b7791b] text-[13px] font-bold">
                  {statusLabel(g.status)}
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  {["LODGED", "ESCALATED"].includes(g.status) && (
                    <button
                      type="button"
                      disabled={actingId === g._id}
                      onClick={() => handleAssignToSelf(g._id)}
                      className="h-7 px-2.5 rounded-lg bg-[#eef3f8] text-[#365a80] text-[13px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      Assign to me
                    </button>
                  )}
                  {NEXT_STATUS[g.status] && (
                    <button
                      type="button"
                      disabled={actingId === g._id}
                      onClick={() => handleAdvanceStatus(g._id, g.status)}
                      className="h-7 px-2.5 rounded-lg bg-[#e3f4ec] text-[#357a5f] text-[13px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      Mark {statusLabel(NEXT_STATUS[g.status])}
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>

        {!loading && data.total > data.limit && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[15px] text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
