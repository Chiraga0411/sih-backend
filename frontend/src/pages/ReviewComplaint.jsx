import React, { useState } from "react";
import { Sparkles, Info, Pencil, Check, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { submitGrievance, ApiError } from "../lib/api";
import { getProfile, saveProfile, addMyComplaintId } from "../lib/storage";
import { priorityFromUrgency } from "../lib/format";

const ReviewComplaint = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const draft = routerLocation.state;

  const profile = getProfile();
  const [phone, setPhone] = useState(profile.phone || "");
  const [name, setName] = useState(profile.name || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!draft?.text) {
    return (
      <div className="h-screen w-full bg-[#f7f7f5] flex overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 flex flex-col">
          <Topbar title="Review complaint" onMenuClick={() => setSidebarOpen(true)} />
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <p className="text-sm text-[#7d858e]">
              There's nothing to review yet — start by describing your
              complaint.
            </p>
            <button
              type="button"
              onClick={() => navigate("/report")}
              className="h-10 px-5 rounded-xl bg-[#203d63] text-white text-xs font-bold cursor-pointer"
            >
              Report an issue
            </button>
          </div>
        </main>
      </div>
    );
  }

  const { text, language, location, addressText, classification, departmentPreview } =
    draft;

  async function handleSubmit() {
    if (!phone.trim()) {
      setError("A phone number is required so we can send you updates.");
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
          title="Review complaint"
          subtitle="Confirm the details before we send this to the department"
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
                    We understood your complaint
                  </h1>
                  <p className="text-[14px] text-[#89929c] mt-1 leading-[1.5] max-w-[450px]">
                    Please check the details below — you can edit anything
                    before it's sent to the department.
                  </p>
                </div>
              </div>

              {/* DETAILS CARD */}
              <div className="bg-white border border-[#e2e5e8] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <DetailCell
                    label="Issue"
                    value={classification?.issueType || "General"}
                    className="border-b sm:border-r border-[#e8eaec]"
                  />
                  <DetailCell
                    label="Department"
                    value={departmentPreview?.name || "—"}
                    className="border-b border-[#e8eaec]"
                  />
                  <DetailCell
                    label="Location"
                    value={
                      addressText ||
                      (location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "—")
                    }
                    className="border-b sm:border-b-0 sm:border-r border-[#e8eaec]"
                  />
                  <div className="px-5 py-5">
                    <p className="text-[13px] font-bold tracking-[0.12em] text-[#8a939d] uppercase">
                      Priority
                    </p>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#fff0d0] text-[#b77b16] text-[13px] font-bold">
                        {priorityFromUrgency(classification?.urgencyLevel)}
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
                  Your details (for status updates)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-xl border border-[#e1e4e7] px-3 text-[15px] outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="Phone number *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10 rounded-xl border border-[#e1e4e7] px-3 text-[15px] outline-none"
                  />
                </div>
              </div>

              {error && (
                <p className="mt-3 text-[14px] font-semibold text-[#c94b4b]">
                  {error}
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
                  Edit
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-11 rounded-xl bg-[#f5a000] text-[#17202a] flex items-center justify-center gap-2 text-[14px] font-bold cursor-pointer hover:bg-[#e99600] disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      Confirm & Submit
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
