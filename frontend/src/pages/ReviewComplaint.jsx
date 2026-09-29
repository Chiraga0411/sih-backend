import React, { useState } from "react";
import { Sparkles, Info, Pencil, Check, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { submitGrievance, ApiError } from "../lib/api";
import { getProfile, saveProfile, addMyComplaintId, isVerifiedFor, clearAuth } from "../lib/storage";
import PhoneVerification from "../components/PhoneVerification";
import { priorityFromUrgency } from "../lib/format";
import { useI18n } from "../lib/i18n";

const ReviewComplaint = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const draft = routerLocation.state;

  const profile = getProfile();
  const [phone, setPhone] = useState(profile.phone || "");
  const [name, setName] = useState(profile.name || "");
  const [verified, setVerified] = useState(() => isVerifiedFor(profile.phone));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!draft?.text) {
    return (
      <div className="h-screen w-full bg-[#f7f7f5] flex overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 flex flex-col">
          <Topbar title={t("Review complaint")} onMenuClick={() => setSidebarOpen(true)} />
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <p className="text-sm text-[#7d858e]">
              {t("There's nothing to review yet — start by describing your complaint.")}
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

  const { text, language, location, addressText, classification, departmentPreview } =
    draft;

  async function handleSubmit() {
    if (!verified) {
      setError("Please verify your phone number first.");
      return;
    }
    if (!location?.lat || !location?.lng) {
      setError("Location is missing — go back and share your location.");
      return;
    }
    if (!departmentPreview?.id) {
      setError("Department could not be determined — go back and try again.");
      return;
    }

    setSubmitting(true);
    setError("");
    saveProfile({ phone: phone.trim(), name: name.trim() });

    try {
      const res = await submitGrievance({
        text,
        language,
        channel: "WEB",
        location,
        addressText,
        classification,
        departmentId: departmentPreview.id,
        citizen: { phone: phone.trim(), name: name.trim() },
      });

      addMyComplaintId(res.complaintId);

      if (res.duplicate) {
        navigate("/report/duplicate", {
          state: {
            complaintId: res.complaintId,
            similarityScore: res.similarityScore,
            issueText: text,
            departmentName: departmentPreview.name,
          },
        });
      } else {
        navigate(
          `/report/success?id=${encodeURIComponent(res.complaintId)}&type=new`,
          {
            state: {
              issueText: text,
              departmentName: res.department?.name || departmentPreview.name,
              addressText,
            },
          }
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setVerified(false); // token expired
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong submitting your complaint."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-screen w-full bg-[#f7f7f5] flex overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title={t("Review complaint")}
          subtitle={t("Confirm the details before we send this to the department")}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-full flex justify-center">
            <div className="w-full max-w-[650px] px-4 sm:px-6 pt-8 sm:pt-16 pb-12">
              {/* INTRO */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#eef3f8] flex items-center justify-center shrink-0">
                  <Sparkles size={16} className="text-[#42627e]" />
                </div>
                <div>
                  <h1 className="text-[22px] font-bold text-[#263b53] leading-tight">
                    {t("We understood your complaint")}
                  </h1>
                  <p className="text-[14px] text-[#89929c] mt-1 leading-[1.5] max-w-[450px]">
                    {t("Please check the details below — you can edit anything before it's sent to the department.")}
                  </p>
                </div>
              </div>

              {/* DETAILS CARD */}
              <div className="bg-white border border-[#e2e5e8] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <DetailCell
                    label={t("Issue")}
                    value={classification?.issueType || t("General")}
                    className="border-b sm:border-r border-[#e8eaec]"
                  />
                  <DetailCell
                    label={t("Department")}
                    value={departmentPreview?.name ? t(departmentPreview.name) : "—"}
                    className="border-b border-[#e8eaec]"
                  />
                  <DetailCell
                    label={t("Location")}
                    value={
                      addressText ||
                      (location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "—")
                    }
                    className="border-b sm:border-b-0 sm:border-r border-[#e8eaec]"
                  />
                  <div className="px-5 py-5">
                    <p className="text-[13px] font-bold tracking-[0.12em] text-[#8a939d] uppercase">
                      {t("Priority")}
                    </p>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#fff0d0] text-[#b77b16] text-[13px] font-bold">
                        {t(priorityFromUrgency(classification?.urgencyLevel))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ORIGINAL TEXT */}
              <div className="mt-4 w-full rounded-xl bg-[#eef0fb] border border-[#e4e6f3] px-4 py-3 flex items-start gap-3">
                <Info size={14} className="text-[#62728a] shrink-0 mt-0.5" />
                <p className="text-[13px] font-medium text-[#58677c] leading-[1.4]">
                  “{text}”
                </p>
              </div>

              {/* CITIZEN DETAILS */}
              <div className="mt-4 bg-white border border-[#e2e5e8] rounded-2xl px-5 py-5">
                <p className="text-[13px] font-bold tracking-[0.12em] text-[#8a939d] uppercase mb-3">
                  {t("Your details (for status updates)")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder={t("Your name (optional)")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-xl border border-[#e1e4e7] px-3 text-[15px] outline-none"
                  />
                  {verified ? (
                    <div className="h-10 rounded-xl border border-[#cfe6d4] bg-[#f1faf3] px-3 flex items-center justify-between">
                      <span className="text-[15px] text-[#263b53]">{phone}</span>
                      <button
                        type="button"
                        onClick={() => {
                          clearAuth();
                          setVerified(false);
                        }}
                        className="text-[12px] font-bold text-[#2f7d4a] cursor-pointer"
                      >
                        {t("✓ Verified · Change")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {!verified && (
                <div className="mt-4">
                  <PhoneVerification
                    initialPhone={phone}
                    onVerified={(verifiedPhone) => {
                      setPhone(verifiedPhone);
                      saveProfile({ phone: verifiedPhone });
                      setVerified(true);
                      setError("");
                    }}
                  />
                </div>
              )}

              {error && (
                <p className="mt-3 text-[14px] font-semibold text-[#c94b4b]">
                  {t(error)}
                </p>
              )}

              {/* ACTIONS */}
              <div className="mt-4 grid grid-cols-[1fr_1.8fr] gap-3">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/report", { state: { prefillText: text } })
                  }
                  className="h-11 rounded-xl border border-[#e1e4e7] bg-white flex items-center justify-center gap-2 text-[14px] font-bold text-[#4e5d6e] cursor-pointer hover:bg-[#fafafa]"
                >
                  <Pencil size={13} />
                  {t("Edit")}
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !verified}
                  className="h-11 rounded-xl bg-[#f5a000] text-[#17202a] flex items-center justify-center gap-2 text-[14px] font-bold cursor-pointer hover:bg-[#e99600] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      {t("Submitting…")}
                    </>
                  ) : (
                    <>
                      {t("Confirm & Submit")}
                      <Check size={13} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function DetailCell({ label, value, className = "" }) {
  return (
    <div className={`px-5 py-5 ${className}`}>
      <p className="text-[13px] font-bold tracking-[0.12em] text-[#8a939d] uppercase">
        {label}
      </p>
      <p className="mt-2 text-[15px] font-bold text-[#263b53]">{value}</p>
    </div>
  );
}

export default ReviewComplaint;
