import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Droplets,
  FileText,
  House,
  Lightbulb,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  Waves,
  Zap,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { trackGrievance } from "../lib/api";
import { getMyComplaintIds, getProfile } from "../lib/storage";
import { statusLabel } from "../lib/format";
import { useI18n } from "../lib/i18n";


// ======================================================
// QUICK REPORT DATA
// ======================================================

const quickReports = [
  {
    name: "Water",
    icon: Droplets,
  },
  {
    name: "Roads",
    icon: Waves,
  },
  {
    name: "Power",
    icon: Zap,
  },
  {
    name: "Sanitation",
    icon: Trash2,
  },
  {
    name: "Property",
    icon: House,
  },
  {
    name: "Other",
    icon: Plus,
  },
];


// ======================================================
// HOME
// ======================================================

function Home() {
  const navigate = useNavigate();
  const profile = getProfile();
  const { t } = useI18n();

  const [recentComplaints, setRecentComplaints] = useState([]);
  const [allStatuses, setAllStatuses] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const ids = getMyComplaintIds();
    if (ids.length === 0) {
      setLoadingRecent(false);
      return;
    }
    Promise.allSettled(ids.map((id) => trackGrievance(id))).then((results) => {
      const grievances = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      setAllStatuses(grievances.map((g) => g.status));
      setRecentComplaints(
        grievances.slice(0, 3).map((g) => ({
          id: g.complaintId,
          title: g.department ? `${g.department} complaint` : g.complaintId,
          department: g.department || "—",
          status: statusLabel(g.status),
        }))
      );
      setLoadingRecent(false);
    });
  }, []);

  const activeCount = allStatuses.filter((s) =>
    ["LODGED", "ASSIGNED", "IN_PROGRESS", "ESCALATED"].includes(s)
  ).length;
  const resolvedCount = allStatuses.filter((s) => s === "RESOLVED").length;

  return (
    <div className="h-screen bg-[#f7f7f5] flex overflow-hidden">

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />


      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="flex-1 min-w-0 flex flex-col">

        {/* ==================================================
            HOME TOPBAR

            Greeting is passed ONLY on Home.
            Other pages can simply use <Topbar />.
        ================================================== */}

        <Topbar
          title={`${t("Hello")}${profile.name ? `, ${profile.name}` : ""} 👋`}
          subtitle={t("Here's what's happening with your complaints")}
          onMenuClick={() => setSidebarOpen(true)}
        />


        {/* ==================================================
            HOME CONTENT
        ================================================== */}

        <div className="flex-1 overflow-y-auto">

          <div className="w-full px-4 sm:px-5 lg:px-7 pt-0 pb-7">


            {/* ==================================================
                SPEAK YOUR COMPLAINT
            ================================================== */}

            <button
              type="button"
              onClick={() => navigate("/report")}
              className="
                w-full
                min-h-[100px] sm:min-h-[116px]
                rounded-2xl
                bg-[#073c62]
                px-4 sm:px-6
                py-4 sm:py-0
                flex
                items-center
                gap-3 sm:gap-4
                text-left
                cursor-pointer
                hover:bg-[#0a426a]
                transition-colors
              "
            >

              {/* ICON */}

              <div
                className="
                  w-12
                  h-12
                  rounded-full
                  bg-[#f5a900]
                  flex
                  items-center
                  justify-center
                  shrink-0
                "
              >

                <Lightbulb
                  size={21}
                  className="text-[#172b43]"
                />

              </div>


              {/* TEXT */}

              <div className="min-w-0 flex-1">

                <h2 className="text-[19px] font-bold text-white">
                  {t("Speak your complaint — any language")}
                </h2>

                <p className="text-[14px] text-[#d9e3eb] mt-1">
                  {t("किसी भी भाषा में बोलें, हम इसे सही विभाग तक पहुँचाएँगे")}
                </p>


                {/* ACTION BUTTONS */}

                <div className="flex items-center gap-2 mt-3">

                  <span
                    className="
                      h-7
                      px-3
                      rounded-full
                      bg-[#f5a900]
                      text-[#172b43]
                      text-[13px]
                      font-bold
                      flex
                      items-center
                      gap-1.5
                    "
                  >
                    🎙 {t("Start speaking")}
                  </span>

                  <span
                    className="
                      h-7
                      px-3
                      rounded-full
                      bg-[#315b79]
                      text-white
                      text-[13px]
                      font-semibold
                    "
                  >
                    {t("Type instead")}
                  </span>

                </div>

              </div>

            </button>


            {/* ==================================================
                DASHBOARD GRID
            ================================================== */}

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_200px] gap-4 mt-5">


              {/* ==================================================
                  LEFT COLUMN
              ================================================== */}

              <div className="min-w-0">


                {/* ==================================================
                    QUICK REPORT
                ================================================== */}

                <div>

                  <p className="text-[13px] font-bold tracking-[0.12em] text-[#78818b] mb-2">
                    {t("QUICK REPORT")}
                  </p>


                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">

                    {quickReports.map((item) => {

                      const Icon = item.icon;

                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => navigate("/report")}
                          className="
                            h-[62px]
                            bg-white
                            border
                            border-[#e5e6e5]
                            rounded-xl
                            flex
                            flex-col
                            items-center
                            justify-center
                            gap-1
                            cursor-pointer
                            hover:border-[#cfd5d9]
                            hover:bg-[#fcfcfc]
                            transition-colors
                          "
                        >

                          <Icon
                            size={14}
                            className="text-[#69798a]"
                          />

                          <span className="text-[13px] font-semibold text-[#667384]">
                            {t(item.name)}
                          </span>

                        </button>
                      );

                    })}

                  </div>

                </div>


                {/* ==================================================
                    RECENT ACTIVITY
                ================================================== */}

                <div className="mt-5">

                  <div className="flex items-center justify-between mb-2">

                    <p className="text-[13px] font-bold tracking-[0.12em] text-[#78818b]">
                      {t("RECENT ACTIVITY")}
                    </p>


                    <button
                      type="button"
                      onClick={() => navigate("/track")}
                      className="
                        flex
                        items-center
                        gap-1
                        text-[13px]
                        font-bold
                        text-[#687587]
                        cursor-pointer
                        hover:text-[#203d63]
                      "
                    >

                      {t("View all")}

                      <ArrowRight size={10} />

                    </button>

                  </div>


                  {/* COMPLAINT LIST */}

                  <div className="bg-white border border-[#e5e6e5] rounded-2xl overflow-hidden">

                    {loadingRecent && (
                      <p className="px-4 py-4 text-[14px] text-[#9299a1]">
                        Loading…
                      </p>
                    )}

                    {!loadingRecent && recentComplaints.length === 0 && (
                      <p className="px-4 py-4 text-[14px] text-[#9299a1]">
                        {t("No complaints filed from this device yet.")}
                      </p>
                    )}

                    {recentComplaints.map((complaint, index) => (
                      <button
                        key={complaint.id}
                        type="button"
                        onClick={() =>
                          navigate(`/track/${complaint.id}`)
                        }
                        className={`
                          w-full
                          px-4
                          py-3
                          flex
                          items-center
                          justify-between
                          text-left
                          cursor-pointer
                          hover:bg-[#fafafa]
                          transition-colors
                          ${
                            index !== recentComplaints.length - 1
                              ? "border-b border-[#ececea]"
                              : ""
                          }
                        `}
                      >

                        <div className="flex items-center gap-3 min-w-0">

                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#eef2f7]">
                            <FileText size={14} className="text-[#64778d]" />
                          </div>

                          <div className="min-w-0">

                            <p className="text-[14px] font-bold text-[#35475b] truncate">
                              {complaint.department && complaint.department !== "—" ? t("{dept} complaint", { dept: t(complaint.department) }) : complaint.title}
                            </p>

                            <p className="text-[13px] text-[#969da4] mt-0.5">
                              {complaint.id} · {t(complaint.department)}
                            </p>

                          </div>

                        </div>


                        <StatusBadge
                          status={complaint.status}
                        />

                      </button>
                    ))}

                  </div>

                </div>

              </div>


              {/* ==================================================
                  RIGHT COLUMN
              ================================================== */}

              <div className="space-y-3">


                {/* ACTIVE + RESOLVED */}

                <div className="grid grid-cols-2 gap-2">

                  <StatCard
                    number={String(activeCount)}
                    label={t("Active")}
                    numberClass="text-[#27384d]"
                  />

                  <StatCard
                    number={String(resolvedCount)}
                    label={t("Resolved")}
                    numberClass="text-[#329b83]"
                  />

                </div>


                {/* TOTAL FILED */}

                <div className="bg-white border border-[#e5e6e5] rounded-2xl p-4">

                  <p className="text-[13px] font-bold tracking-[0.08em] text-[#78818b]">
                    {t("TOTAL COMPLAINTS FILED")}
                  </p>

                  <p className="text-[24px] font-bold text-[#27384d] mt-2">
                    {allStatuses.length}
                  </p>

                  <p className="text-[13px] text-[#9299a1] mt-1">
                    {t("From this device")}
                  </p>

                </div>


                {/* DID YOU KNOW */}

                <div className="bg-[#eef0fa] border border-[#e2e4f0] rounded-2xl p-4">

                  <div className="flex items-center gap-1.5">

                    <ShieldCheck
                      size={12}
                      className="text-[#66728e]"
                    />

                    <p className="text-[13px] font-bold text-[#66728e]">
                      {t("Did you know?")}
                    </p>

                  </div>


                  <p className="text-[13px] leading-3.5 text-[#7b8496] mt-2">
                    {t("Every complaint is auto-checked against nearby reports — if others already flagged the same issue, your complaint gets merged for faster action.")}
                  </p>

                </div>


                {/* PROFILE */}

                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="
                    w-full
                    bg-white
                    border
                    border-[#e5e6e5]
                    rounded-2xl
                    p-3
                    flex
                    items-center
                    gap-3
                    text-left
                    cursor-pointer
                    hover:bg-[#fafafa]
                    transition-colors
                  "
                >

                  <div
                    className="
                      w-8
                      h-8
                      rounded-full
                      bg-[#fff1d4]
                      flex
                      items-center
                      justify-center
                    "
                  >

                    <User
                      size={14}
                      className="text-[#c49424]"
                    />

                  </div>


                  <div className="flex-1">

                    <p className="text-[14px] font-bold text-[#35475b]">
                      {profile.name || t("Add your name")}
                    </p>

                    <p className="text-[13px] text-[#9299a1] mt-0.5">
                      {profile.location || t("Add your location")}
                    </p>

                  </div>


                  <ChevronRight
                    size={13}
                    className="text-[#9299a1]"
                  />

                </button>

              </div>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}


// ======================================================
// STAT CARD
// ======================================================

function StatCard({
  number,
  label,
  numberClass,
}) {
  return (
    <div className="bg-white border border-[#e5e6e5] rounded-2xl p-4">

      <p className={`text-[24px] font-bold ${numberClass}`}>
        {number}
      </p>

      <p className="text-[13px] font-semibold text-[#8a929a] mt-1">
        {label}
      </p>

    </div>
  );
}


// ======================================================
// STATUS BADGE
// ======================================================

function StatusBadge({ status }) {
  const { t } = useI18n();

  const styles = {
    "In progress": "bg-[#fff1d4] text-[#c49424]",
    Assigned: "bg-[#e9eef5] text-[#64778d]",
    Resolved: "bg-[#dff2ec] text-[#329b83]",
  };

  return (
    <span
      className={`
        shrink-0
        px-2
        py-1
        rounded-full
        text-[13px]
        font-bold
        ${styles[status] || "bg-[#edf0f2] text-[#687587]"}
      `}
    >
      {t(status)}
    </span>
  );
}


export default Home;