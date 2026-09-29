import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  FileText,
  MapPin,
  Info,
  Link2,
  Plus,
  Loader2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { trackGrievance, ApiError } from "../lib/api";
import { statusLabel } from "../lib/format";
import { useI18n } from "../lib/i18n";

const DuplicateComplaints = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const draft = routerLocation.state;

  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!draft?.complaintId) {
      setLoading(false);
      return;
    }
    trackGrievance(draft.complaintId)
      .then(setExisting)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load the existing complaint.")
      )
      .finally(() => setLoading(false));
  }, [draft?.complaintId]);

  if (!draft?.complaintId) {
    return (
      <div className="h-screen w-full bg-[#f7f7f5] flex overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 flex flex-col">
          <Topbar title={t("Review complaint")} onMenuClick={() => setSidebarOpen(true)} />
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <p className="text-sm text-[#7d858e]">
              {t("Nothing to show here yet.")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/report")}
              className="h-10 px-5 rounded-xl bg-[#203d63] text-white text-xs font-bold cursor-pointer"
            >
              {t("Report an issue")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const similarityPct = draft.similarityScore
    ? Math.round(draft.similarityScore * 100)
    : null;

  function goToSuccess() {
    navigate(
      `/report/success?id=${encodeURIComponent(draft.complaintId)}&type=merged`,
      {
        state: {
          issueText: draft.issueText,
          departmentName: existing?.department || draft.departmentName,
        },
      }
    );
  }

  return (
    <div className="h-screen w-full bg-[#f7f7f5] flex overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title={t("Review complaint")}
          subtitle={t("Checked for similar reports nearby before submission")}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-full flex justify-center">
            <div className="w-full max-w-[680px] px-4 sm:px-6 pt-8 sm:pt-14 pb-12">
              {/* WARNING / INTRO */}
              <div className="flex flex-col items-center text-center mb-7">
                <div className="w-10 h-10 rounded-full bg-[#fff3d9] flex items-center justify-center mb-3">
                  <AlertTriangle size={18} className="text-[#d69a1b]" />
                </div>
                <h1 className="text-[22px] font-bold text-[#263b53]">
                  {t("We found a similar complaint")}
                </h1>
                <p className="text-[13px] text-[#89929c] mt-2 max-w-[470px] leading-[1.5]">
                  {t("There's already an open complaint about a similar issue near your location")}
                  {similarityPct ? ` (${similarityPct}% ${t("match")})` : ""}.{" "}
                  {t("Your report has been merged into it automatically to keep duplicate tickets from splitting up department attention.")}
                </p>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-[15px] text-[#8b939c]">
                  <Loader2 size={14} className="animate-spin" />
                  {t("Loading existing complaint…")}
                </div>
              )}

              {error && (
                <p className="text-center text-[14px] font-semibold text-[#c94b4b] mb-4">
                  {t(error)}
                </p>
              )}

              {!loading && (
                <>
                  {/* EXISTING COMPLAINT CARD */}
                  <div className="bg-white border border-[#e2e5e8] rounded-2xl overflow-hidden">
                    <div className="px-5 pt-5 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-[#637386]" />
                          <span className="text-[13px] font-bold tracking-[0.13em] text-[#718091]">
                            {t("EXISTING COMPLAINT")}
                          </span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-[#fff0d0] text-[#b77b16] text-[13px] font-bold">
                          {t(statusLabel(existing?.status))}
                        </span>
                      </div>

                      <div className="flex items-start gap-3 mt-5">
                        <div className="w-9 h-9 rounded-xl bg-[#eef3f8] flex items-center justify-center shrink-0">
                          <FileText size={15} className="text-[#58718b]" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-[#263b53]">
                            {draft.issueText || t("Merged complaint")}
                          </p>
                          <p className="text-[13px] text-[#8b949f] mt-1">
                            {t("Complaint ID")}: {draft.complaintId}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-[#fafafa] border border-[#eef0f1] rounded-xl px-4 py-4">
                          <p className="text-[13px] font-bold tracking-[0.12em] text-[#8a939d]">
                            {t("DEPARTMENT")}
                          </p>
                          <p className="mt-2 text-[14px] font-bold text-[#34475b]">
                            {t(existing?.department || draft.departmentName || "—")}
                          </p>
                        </div>
                        <div className="bg-[#fafafa] border border-[#eef0f1] rounded-xl px-4 py-4">
                          <p className="text-[13px] font-bold tracking-[0.12em] text-[#8a939d]">
                            {t("SLA TARGET")}
                          </p>
                          <p className="mt-2 text-[14px] font-bold text-[#34475b]">
                            {existing?.slaTarget
                              ? new Date(existing.slaTarget).toLocaleDateString("en-IN")
                              : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <MapPin size={13} className="text-[#6e8394]" />
                        <p className="text-[13px] text-[#788593]">
                          {t("Matched to a nearby, similar open report")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* WHY */}
                  <div className="mt-4 rounded-xl bg-[#eef0f6] border border-[#e5e7ed] px-4 py-4 flex items-start gap-3">
                    <Info size={14} className="text-[#66758a] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[13px] font-bold text-[#536477]">
                        {t("Why we're suggesting this")}
                      </p>
                      <p className="text-[13px] text-[#89929c] leading-[1.5] mt-1">
                        {t("Your complaint matched an existing report's category and location closely enough that the system merged it automatically, so department staff see one ticket instead of duplicates.")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goToSuccess}
                    className="w-full h-12 rounded-xl bg-[#123f65] text-white flex items-center justify-center gap-2 cursor-pointer mt-6"
                  >
                    <Link2 size={14} />
                    <div className="text-left">
                      <p className="text-[14px] font-bold">
                        {t("View merged complaint")}
                      </p>
                      <p className="text-[12px] opacity-75 mt-0.5">
                        {t("Your report has been added to this ticket")}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/report")}
                    className="w-full h-11 rounded-xl border border-[#dfe3e7] bg-white text-[#34475b] flex items-center justify-center gap-2 text-[14px] font-bold cursor-pointer hover:bg-[#fafafa] mt-3"
                  >
                    <Plus size={14} />
                    {t("File a different complaint instead")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DuplicateComplaints;
