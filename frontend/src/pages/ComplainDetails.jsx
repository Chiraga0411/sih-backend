import React, { useEffect, useState } from "react";
import {
  Home,
  Mic,
  List,
  User,
  MapPin,
  Building2,
  Check,
  ArrowLeft,
  Loader2,
  Star,
  Menu,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { trackGrievance, submitFeedback, ApiError } from "../lib/api";
import { getProfile } from "../lib/storage";
import { statusLabel, formatDate, formatDateTime } from "../lib/format";
import { useI18n } from "../lib/i18n";

const ALL_STATUSES = ["LODGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

const ComplaintDetails = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const profile = getProfile();

  const [grievance, setGrievance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function load() {
    setLoading(true);
    trackGrievance(id)
      .then((g) => {
        setGrievance(g);
        if (g.feedback) setFeedbackSubmitted(true);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load this complaint."
        )
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleFeedback() {
    if (!rating) return;
    setFeedbackSubmitting(true);
    try {
      await submitFeedback(id, { rating, comment, confirmedResolved: true });
      setFeedbackSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not submit feedback right now."
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  const reachedIndex = grievance
    ? Math.max(0, ALL_STATUSES.indexOf(grievance.status))
    : -1;

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#172033] flex">
      {/* ================= SIDEBAR (static, lg and up) ================= */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[210px] bg-[#073b5c] text-white flex-col z-20">
        <div className="px-5 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffb000] flex items-center justify-center">
              <Mic size={19} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-[20px] leading-tight">
                Nagrik Sahayak
              </h1>
              <p className="text-[13px] text-white/70">नागरिक सहायक</p>
            </div>
          </div>
        </div>

        <nav className="px-3 space-y-2">
          <button
            onClick={() => navigate("/home")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/80 hover:bg-white/10"
          >
            <Home size={17} />
            <span>{t("Home")}</span>
          </button>

          <button
            onClick={() => navigate("/report")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/80 hover:bg-white/10"
          >
            <Mic size={17} />
            <span>{t("Report an issue")}</span>
          </button>

          <button
            onClick={() => navigate("/track")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/15 text-white font-medium"
          >
            <List size={17} />
            <span>{t("Track complaints")}</span>
          </button>

          <button
            onClick={() => navigate("/profile")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/80 hover:bg-white/10"
          >
            <User size={17} />
            <span>{t("Profile")}</span>
          </button>
        </nav>

        <div className="mt-auto px-4 pb-5">
          <div className="mb-5 px-2 text-xs text-white/80">
            🌐 {profile.language || "Hindi"}
          </div>

          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[#fff2c9] text-[#8d6a00] flex items-center justify-center text-xs font-semibold">
              {(profile.name || "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold">
                {profile.name || t("Citizen")}
              </p>
              <p className="text-[13px] text-white/60">
                {profile.location || "—"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= SIDEBAR (mobile off-canvas drawer, below lg) ================= */}
      <div className={`lg:hidden fixed inset-0 z-40 ${sidebarOpen ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setSidebarOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            sidebarOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-[230px] max-w-[80vw] h-full bg-[#073b5c] text-white flex flex-col transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="px-5 pt-6 pb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ffb000] flex items-center justify-center">
                <Mic size={19} className="text-white" />
              </div>
              <div>
                <h1 className="font-bold text-[20px] leading-tight">
                  Nagrik Sahayak
                </h1>
                <p className="text-[13px] text-white/70">नागरिक सहायक</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="px-3 space-y-2">
            <button
              onClick={() => navigate("/home")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/80 hover:bg-white/10"
            >
              <Home size={17} />
              <span>{t("Home")}</span>
            </button>

            <button
              onClick={() => navigate("/report")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/80 hover:bg-white/10"
            >
              <Mic size={17} />
              <span>{t("Report an issue")}</span>
            </button>

            <button
              onClick={() => navigate("/track")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/15 text-white font-medium"
            >
              <List size={17} />
              <span>{t("Track complaints")}</span>
            </button>

            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/80 hover:bg-white/10"
            >
              <User size={17} />
              <span>{t("Profile")}</span>
            </button>
          </nav>
        </aside>
      </div>

      {/* ================= MAIN AREA ================= */}
      <main className="w-full lg:ml-[210px] lg:w-[calc(100%-210px)] min-h-screen">
        <div className="h-[64px] sm:h-[78px] bg-white border-b border-gray-100 flex items-center gap-3 px-4 sm:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border border-gray-200 hover:bg-gray-50"
          >
            <Menu size={16} className="text-[#172033]" />
          </button>
          <h2 className="text-[20px] sm:text-[24px] font-bold text-[#172033] truncate">{id}</h2>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
          <button
            onClick={() => navigate("/track")}
            className="flex items-center gap-2 text-[16px] text-gray-500 mb-5"
          >
            <ArrowLeft size={14} />
            {t("Back to complaints")}
          </button>

          {loading && (
            <div className="flex items-center gap-2 text-[17px] text-gray-400 py-10">
              <Loader2 size={16} className="animate-spin" />
              {t("Loading complaint…")}
            </div>
          )}

          {!loading && error && (
            <p className="text-[17px] font-semibold text-[#c94b4b] py-10">
              {t(error)}
            </p>
          )}

          {!loading && grievance && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
                <div className="min-w-0">
                  <p className="text-[14px] uppercase tracking-[0.15em] text-gray-400 font-semibold mb-2">
                    {t("Complaint details")}
                  </p>
                  <h1 className="text-[24px] sm:text-[31px] font-bold text-[#172033] truncate">
                    {grievance.complaintId}
                  </h1>
                  <p className="text-[15px] text-gray-400 mt-1">
                    {grievance.department ? t(grievance.department) : t("Department pending")}
                  </p>
                </div>

                <span className="self-start px-4 py-2 rounded-full bg-[#fff1d6] text-[#c48600] text-[14px] font-semibold shrink-0">
                  {t(statusLabel(grievance.status))}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
                {/* LEFT */}
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="px-6 py-5 border-b border-gray-100">
                      <h3 className="text-[16px] uppercase tracking-[0.12em] font-semibold text-gray-500">
                        {t("Complaint information")}
                      </h3>
                    </div>

                    <div className="px-4 sm:px-6 py-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-[#fafbfc] rounded-xl p-4">
                          <p className="text-[13px] uppercase tracking-wider text-gray-400 mb-2">
                            {t("Department")}
                          </p>
                          <p className="text-[16px] font-semibold text-[#172033]">
                            {grievance.department ? t(grievance.department) : "—"}
                          </p>
                        </div>

                        <div className="bg-[#fafbfc] rounded-xl p-4">
                          <p className="text-[13px] uppercase tracking-wider text-gray-400 mb-2">
                            {t("SLA target")}
                          </p>
                          <p className="text-[16px] font-semibold text-[#172033]">
                            {formatDate(grievance.slaTarget)}
                            {grievance.slaBreached && (
                              <span className="text-[#c94b4b]"> (breached)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center gap-2 text-[14px] text-gray-400">
                        <span>◷</span>
                        {t("Reported on {date}", { date: formatDate(grievance.createdAt) })}
                      </div>
                    </div>
                  </div>

                  {/* FEEDBACK */}
                  {grievance.status === "RESOLVED" && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <h3 className="text-[16px] uppercase tracking-[0.12em] font-semibold text-gray-500 mb-4">
                        {t("Rate your experience")}
                      </h3>

                      {feedbackSubmitted ? (
                        <p className="text-[16px] text-[#398d70] font-semibold">
                          {t("Thanks — your feedback has been recorded.")}
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 mb-4">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setRating(n)}
                                className="cursor-pointer"
                              >
                                <Star
                                  size={22}
                                  className={
                                    n <= rating
                                      ? "text-[#f5a900] fill-[#f5a900]"
                                      : "text-gray-300"
                                  }
                                />
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={t("Anything you'd like to add? (optional)")}
                            className="w-full h-20 rounded-xl border border-gray-200 p-3 text-[16px] outline-none resize-none"
                          />
                          <button
                            type="button"
                            onClick={handleFeedback}
                            disabled={!rating || feedbackSubmitting}
                            className="mt-3 h-10 px-5 rounded-xl bg-[#203d63] text-white text-[15px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            {feedbackSubmitting ? t("Submitting…") : t("Submit feedback")}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* RIGHT */}
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-[14px] uppercase tracking-[0.12em] text-gray-500 font-semibold mb-4">
                      {t("Status")}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#fff3d8] flex items-center justify-center">
                        <span className="text-[#d39200]">◷</span>
                      </div>
                      <div>
                        <p className="text-[17px] font-semibold">
                          {t(statusLabel(grievance.status))}
                        </p>
                        <p className="text-[13px] text-gray-400 mt-1">
                          {t("Current complaint status")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* TIMELINE */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-[14px] uppercase tracking-[0.12em] text-gray-500 font-semibold mb-5">
                      {t("Complaint timeline")}
                    </p>

                    <div className="relative pl-7">
                      <div className="absolute left-[9px] top-2 bottom-4 w-[2px] bg-gray-200" />

                      {(grievance.statusHistory?.length
                        ? grievance.statusHistory
                        : [{ status: "LODGED", timestamp: grievance.createdAt }]
                      ).map((entry, i) => (
                        <div key={i} className="relative pb-7">
                          <div className="absolute -left-7 top-0 w-5 h-5 rounded-full bg-[#49a98b] flex items-center justify-center">
                            <Check size={11} className="text-white" />
                          </div>
                          <p className="text-[15px] font-semibold">
                            {t(statusLabel(entry.status))}
                          </p>
                          <p className="text-[13px] text-gray-400 mt-1">
                            {formatDateTime(entry.timestamp)}
                          </p>
                        </div>
                      ))}

                      {grievance.status !== "RESOLVED" && (
                        <div className="relative">
                          <div className="absolute -left-7 top-0 w-5 h-5 rounded-full bg-white border border-gray-200" />
                          <p className="text-[15px] font-semibold text-gray-400">
                            {t("Resolved")}
                          </p>
                          <p className="text-[13px] text-gray-400 mt-1">{t("Pending")}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin size={14} className="text-[#49a98b]" />
                      <p className="text-[14px] uppercase tracking-[0.12em] font-semibold text-gray-500">
                        {t("Department")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#f1f3f7] flex items-center justify-center">
                        <Building2 size={15} className="text-gray-500" />
                      </div>
                      <p className="text-[16px] font-semibold">
                        {grievance.department ? t(grievance.department) : t("Not yet assigned")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ComplaintDetails;
