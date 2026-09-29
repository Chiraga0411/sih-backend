import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  FileText,
  Home,
  MapPin,
  Loader2,
} from "lucide-react";

import { useNavigate, useSearchParams, useLocation } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { trackGrievance, ApiError } from "../lib/api";
import { addMyComplaintId } from "../lib/storage";
import { formatDate } from "../lib/format";
import { useI18n } from "../lib/i18n";

function ComplaintSuccess() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [searchParams] = useSearchParams();

  const complaintId = searchParams.get("id");
  const isMerged = searchParams.get("type") === "merged";
  const draft = routerLocation.state || {};

  const [grievance, setGrievance] = useState(null);
  const [loading, setLoading] = useState(Boolean(complaintId));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!complaintId) return;
    addMyComplaintId(complaintId);
    trackGrievance(complaintId)
      .then(setGrievance)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [complaintId]);

  if (!complaintId) {
    return (
      <div className="h-screen bg-[#f7f7f5] flex overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 flex flex-col">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <p className="text-sm text-[#7d858e]">{t("No complaint to show.")}</p>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="h-10 px-5 rounded-xl bg-[#203d63] text-white text-xs font-bold cursor-pointer"
            >
              {t("Go to home")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f7f7f5] flex overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
            {/* SUCCESS ICON */}
            <div className="text-center">
              <div className="mx-auto w-[64px] h-[64px] rounded-full bg-[#dff2ec] flex items-center justify-center">
                <div className="w-[42px] h-[42px] rounded-full bg-[#329b83] flex items-center justify-center">
                  <Check size={23} strokeWidth={3} className="text-white" />
                </div>
              </div>

              <h1 className="text-[23px] sm:text-[29px] font-bold text-[#172b43] mt-5 px-2">
                {isMerged
                  ? t("Complaint merged with an existing report")
                  : t("Complaint submitted successfully")}
              </h1>

              <p className="text-xs text-[#7d858e] mt-2">
                {isMerged
                  ? t("We combined your report with a similar open complaint nearby.")
                  : t("Your complaint has been registered and sent to the appropriate department.")}
              </p>
            </div>

            {/* COMPLAINT CARD */}
            <div className="mt-7 bg-white border border-[#e5e6e5] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#ececea]">
                <p className="text-[14px] font-bold tracking-[0.1em] text-[#7c858f]">
                  {t("COMPLAINT ID")}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[21px] font-bold text-[#203d63]">
                    {complaintId}
                  </p>
                  <span className="px-2.5 py-1 rounded-full bg-[#e9eef5] text-[#60748b] text-[13px] font-bold">
                    {loading ? "…" : isMerged ? t("Merged") : t("Submitted")}
                  </span>
                </div>
              </div>

              <div className="p-5">
                {loading ? (
                  <div className="flex items-center gap-2 text-[15px] text-[#8b939c]">
                    <Loader2 size={14} className="animate-spin" />
                    {t("Loading complaint details…")}
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#edf2f7] flex items-center justify-center">
                      <FileText size={16} className="text-[#52677f]" />
                    </div>
                    <div>
                      <p className="text-[17px] font-bold text-[#34475c]">
                        {draft.issueText || t("Your complaint")}
                      </p>
                      <p className="text-[14px] text-[#8c939a] mt-1">
                        {t(grievance?.department || draft.departmentName || "—")}
                        {grievance?.createdAt
                          ? ` · ${t("Filed")} ${formatDate(grievance.createdAt)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                )}

                {draft.addressText && (
                  <div className="mt-4 pt-4 border-t border-[#ececea] flex items-center gap-2">
                    <MapPin size={14} className="text-[#66798f]" />
                    <span className="text-[14px] text-[#727c86]">
                      {draft.addressText}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* STATUS */}
            <div className="mt-3 bg-[#e8eef7] rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Clock3 size={17} className="text-[#52677f] mt-0.5" />
                <div>
                  <p className="text-[15px] font-bold text-[#344b65]">
                    {t("What happens next?")}
                  </p>
                  <p className="text-[14px] leading-4 text-[#68798d] mt-1">
                    {t("The concerned department will review your complaint and assign it to the appropriate officer. You can track its status anytime.")}
                  </p>
                </div>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => navigate(`/track/${complaintId}`)}
                className="h-11 rounded-xl bg-[#203d63] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-[#1a3455]"
              >
                {t("Track complaint")}
                <ArrowRight size={15} />
              </button>

              <button
                type="button"
                onClick={() => navigate("/home")}
                className="h-11 rounded-xl bg-white border border-[#dfe2e4] text-[#526276] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:border-[#bbc2c8]"
              >
                <Home size={15} />
                {t("Go to home")}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ComplaintSuccess;
