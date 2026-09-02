import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Phone, MapPin } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import AdminLayout from "./AdminLayout";
import {
  getGrievance,
  assignGrievance,
  updateStatus,
  ApiError,
} from "../lib/adminApi";
import { statusLabel, formatDateTime } from "../lib/format";

const NEXT_STATUS = {
  ASSIGNED: "IN_PROGRESS",
  IN_PROGRESS: "RESOLVED",
  ESCALATED: "IN_PROGRESS",
};

export default function AdminGrievanceDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [grievance, setGrievance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);

  function load() {
    setLoading(true);
    getGrievance(id)
      .then((res) => setGrievance(res.grievance))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load complaint.")
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleAssign() {
    setActing(true);
    try {
      await assignGrievance(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function handleAdvance() {
    const next = NEXT_STATUS[grievance.status];
    if (!next) return;
    setActing(true);
    try {
      await updateStatus(id, next);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  }

  return (
    <AdminLayout>
      <div className="min-h-[60px] sm:h-[78px] bg-white border-b border-gray-100 flex items-center px-4 sm:px-8 py-4 sm:py-0">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="flex items-center gap-2 text-[16px] text-gray-500 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to queue
        </button>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        {loading && (
          <div className="flex items-center gap-2 text-[17px] text-gray-400 py-10">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        )}

        {!loading && error && (
          <p className="text-[17px] font-semibold text-[#c94b4b]">{error}</p>
        )}

        {!loading && grievance && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <div>
                    <h1 className="text-[21px] sm:text-[24px] font-bold text-[#172033]">
                      {grievance.complaintId}
                    </h1>
                    <p className="text-[14px] text-gray-400 mt-1">
                      {grievance.department?.name || "Unassigned department"}
                    </p>
                  </div>
                  <span className="self-start px-3 py-1.5 rounded-full bg-[#fff1d6] text-[#c48600] text-[14px] font-semibold shrink-0">
                    {statusLabel(grievance.status)}
                  </span>
                </div>

                <p className="text-[17px] text-gray-700 leading-6 bg-[#fafbfc] rounded-xl p-4">
                  {grievance.text}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div className="bg-[#fafbfc] rounded-xl p-4">
                    <p className="text-[13px] uppercase tracking-wider text-gray-400 mb-1">
                      Urgency
                    </p>
                    <p className="text-[16px] font-semibold">
                      {grievance.classification?.urgencyLevel || "—"}
                    </p>
                  </div>
                  <div className="bg-[#fafbfc] rounded-xl p-4">
                    <p className="text-[13px] uppercase tracking-wider text-gray-400 mb-1">
                      Priority score
                    </p>
                    <p className="text-[16px] font-semibold">
                      {grievance.priorityScore ?? "—"}
                    </p>
                  </div>
                </div>

                {grievance.location?.coordinates && (
                  <div className="mt-4 flex items-center gap-2 text-[15px] text-gray-500">
                    <MapPin size={14} />
                    {grievance.addressText ||
                      `${grievance.location.coordinates[1]}, ${grievance.location.coordinates[0]}`}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
                <h3 className="text-[15px] uppercase tracking-[0.12em] font-semibold text-gray-500 mb-4">
                  Status history
                </h3>
                <div className="space-y-3">
                  {(grievance.statusHistory || []).map((h, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <p className="text-[15px] font-semibold text-gray-700">
                        {statusLabel(h.status)}
                      </p>
                      <p className="text-[14px] text-gray-400">
                        {formatDateTime(h.timestamp)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
                <p className="text-[14px] uppercase tracking-[0.12em] text-gray-500 font-semibold mb-3">
                  Citizen
                </p>
                <p className="text-[16px] font-semibold">
                  {grievance.citizen?.name || "Anonymous"}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[15px] text-gray-500">
                  <Phone size={12} />
                  {grievance.citizen?.phone || "—"}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
                <p className="text-[14px] uppercase tracking-[0.12em] text-gray-500 font-semibold mb-3">
                  Assigned to
                </p>
                <p className="text-[16px] font-semibold mb-4">
                  {grievance.assignedStaff?.name || "Unassigned"}
                </p>

                {["LODGED", "ESCALATED"].includes(grievance.status) && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={handleAssign}
                    className="w-full h-9 rounded-lg bg-[#eef3f8] text-[#365a80] text-[14px] font-bold cursor-pointer disabled:opacity-50"
                  >
                    Assign to me
                  </button>
                )}

                {NEXT_STATUS[grievance.status] && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={handleAdvance}
                    className="w-full h-9 mt-2 rounded-lg bg-[#e3f4ec] text-[#357a5f] text-[14px] font-bold cursor-pointer disabled:opacity-50"
                  >
                    Mark {statusLabel(NEXT_STATUS[grievance.status])}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
