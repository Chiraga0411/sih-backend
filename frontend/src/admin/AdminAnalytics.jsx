import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import AdminLayout from "./AdminLayout";
import {
  resolutionMetrics,
  volumeByDepartment,
  slaCompliance,
  ApiError,
} from "../lib/adminApi";

export default function AdminAnalytics() {
  const [metrics, setMetrics] = useState([]);
  const [volume, setVolume] = useState([]);
  const [sla, setSla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([resolutionMetrics(), volumeByDepartment(), slaCompliance()])
      .then(([m, v, s]) => {
        setMetrics(m.metrics);
        setVolume(v.volume);
        setSla(s);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load analytics.")
      )
      .finally(() => setLoading(false));
  }, []);

  const maxVolume = Math.max(1, ...volume.map((v) => v.totalCount));

  return (
    <AdminLayout>
      <div className="min-h-[60px] sm:h-[78px] bg-white border-b border-gray-100 flex items-center px-4 sm:px-8 py-4 sm:py-0">
        <h2 className="text-[20px] sm:text-[22px] font-bold text-[#172033]">Analytics</h2>
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

        {!loading && !error && (
          <div className="space-y-6">
            {/* SLA SUMMARY */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard
                label="SLA compliance"
                value={
                  sla.slaCompliancePercent === null
                    ? "—"
                    : `${sla.slaCompliancePercent}%`
                }
              />
              <SummaryCard
                label="Resolved within SLA"
                value={`${sla.resolvedWithinSla} / ${sla.totalResolved}`}
              />
              <SummaryCard
                label="Currently breached"
                value={String(sla.currentlyOpenAndBreached)}
                danger={sla.currentlyOpenAndBreached > 0}
              />
            </div>

            {/* VOLUME BY DEPARTMENT */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
              <h3 className="text-[15px] uppercase tracking-[0.12em] font-semibold text-gray-500 mb-5">
                Volume by department
              </h3>
              {volume.length === 0 && (
                <p className="text-[16px] text-gray-400">No data yet.</p>
              )}
              <div className="space-y-3">
                {volume.map((v) => (
                  <div key={v.departmentId}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[15px] font-semibold text-gray-700">
                        {v.departmentName || "Unknown"}
                      </p>
                      <p className="text-[14px] text-gray-400">{v.totalCount}</p>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-[#f5a900]"
                        style={{ width: `${(v.totalCount / maxVolume) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RESOLUTION METRICS */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 overflow-x-auto">
              <h3 className="text-[15px] uppercase tracking-[0.12em] font-semibold text-gray-500 mb-4 whitespace-nowrap">
                Avg resolution time (hours), resolved tickets only
              </h3>
              {metrics.length === 0 && (
                <p className="text-[16px] text-gray-400">
                  No resolved tickets yet.
                </p>
              )}
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 min-w-[480px] text-[13px] font-bold text-gray-400 uppercase pb-2 border-b border-gray-100">
                <span>Department</span>
                <span>Avg</span>
                <span>Min / Max</span>
                <span>Resolved count</span>
              </div>
              {metrics.map((m) => (
                <div
                  key={m.departmentId || m.departmentName}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-2 min-w-[480px] py-3 border-b border-gray-50 last:border-b-0"
                >
                  <span className="text-[15px] font-semibold text-gray-700">
                    {m.departmentName || "Unknown"}
                  </span>
                  <span className="text-[15px] text-gray-600">
                    {m.avgResolutionHours}h
                  </span>
                  <span className="text-[15px] text-gray-600">
                    {m.minResolutionHours}h / {m.maxResolutionHours}h
                  </span>
                  <span className="text-[15px] text-gray-600">
                    {m.resolvedCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function SummaryCard({ label, value, danger }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-[13px] font-bold tracking-[0.1em] text-gray-400 uppercase">
        {label}
      </p>
      <p
        className={`text-[27px] font-bold mt-2 ${
          danger ? "text-[#c94b4b]" : "text-[#172033]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
