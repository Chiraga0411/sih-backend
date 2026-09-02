import React, { useEffect, useState } from "react";
import { ChevronDown, Filter, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { trackGrievance, ApiError } from "../lib/api";
import { getMyComplaintIds } from "../lib/storage";
import { statusLabel, formatDate } from "../lib/format";

const MyComplaints = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const [department, setDepartment] = useState("All departments");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const ids = getMyComplaintIds();
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    Promise.allSettled(ids.map((id) => trackGrievance(id))).then((results) => {
      const resolved = results
        .map((r, i) => (r.status === "fulfilled" ? r.value : null))
        .filter(Boolean)
        .map((g) => ({
          id: g.complaintId,
          complaint: g.complaintId, // backend doesn't return the original text on tracking
          department: g.department || "—",
          date: formatDate(g.createdAt),
          status: statusLabel(g.status),
        }));

      if (resolved.length === 0 && results.some((r) => r.status === "rejected")) {
        setError("Couldn't load your complaints right now.");
      }
      setComplaints(resolved);
      setLoading(false);
    });
  }, []);

  const departmentOptions = [
    "All departments",
    ...Array.from(new Set(complaints.map((c) => c.department).filter(Boolean))),
  ];

  const filteredComplaints = complaints
    .filter((item) => {
      if (filter === "Active") {
        return item.status === "In progress" || item.status === "Assigned" || item.status === "Lodged" || item.status === "Escalated";
      }
      if (filter === "Resolved") {
        return item.status === "Resolved";
      }
      return true;
    })
    .filter((item) => department === "All departments" || item.department === department);

  return (
    <div className="h-screen w-full bg-[#f7f7f5] flex overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title="My complaints"
          subtitle="Every report you've filed, in one place"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 lg:px-7 pb-7">
          {/* FILTER ROW */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              {["All", "Active", "Resolved"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`h-9 px-5 rounded-full text-[14px] font-bold cursor-pointer shrink-0 ${
                    filter === f
                      ? "bg-[#174b98] text-white"
                      : "bg-white text-[#667383] border border-[#e5e7e9]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="relative">
              <Filter
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#657486] pointer-events-none"
              />
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="appearance-none h-9 min-w-[145px] pl-8 pr-8 rounded-full bg-white border border-[#e5e7e9] text-[13px] font-semibold text-[#5f6d7d] outline-none cursor-pointer"
              >
                {departmentOptions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#657486] pointer-events-none"
              />
            </div>
          </div>

          {/* TABLE - becomes a stacked card list below md */}
          <div className="mt-5 w-full bg-white border border-[#e4e6e8] rounded-2xl overflow-hidden">
            {/* Column header row - table view only, md and up */}
            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_1.15fr_1fr_0.8fr] px-6 py-4 border-b border-[#eceeef] bg-[#fcfcfb]">
              <div className="text-[13px] font-bold tracking-[0.13em] text-[#737d88]">
                COMPLAINT
              </div>
              <div className="text-[13px] font-bold tracking-[0.13em] text-[#737d88]">
                DEPARTMENT
              </div>
              <div className="text-[13px] font-bold tracking-[0.13em] text-[#737d88]">
                FILED ON
              </div>
              <div className="text-[13px] font-bold tracking-[0.13em] text-[#737d88]">
                STATUS
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-[15px] text-[#8b939c]">
                <Loader2 size={14} className="animate-spin" />
                Loading your complaints…
              </div>
            )}

            {!loading && error && (
              <p className="text-center text-[14px] font-semibold text-[#c94b4b] py-6">
                {error}
              </p>
            )}

            {!loading && !error && complaints.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[15px] text-[#8b939c]">
                  You haven't filed any complaints from this device yet.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/report")}
                  className="mt-3 h-9 px-4 rounded-xl bg-[#203d63] text-white text-[14px] font-bold cursor-pointer"
                >
                  Report an issue
                </button>
              </div>
            )}

            {!loading &&
              filteredComplaints.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => navigate(`/track/${item.id}`)}
                  className="w-full text-left flex flex-col gap-2 md:grid md:grid-cols-[minmax(0,2fr)_1.15fr_1fr_0.8fr] md:gap-0 md:items-center px-4 sm:px-6 py-4 md:py-5 border-b border-[#eef0f1] last:border-b-0 hover:bg-[#fafbfc] cursor-pointer transition-none"
                >
                  <div className="flex items-start justify-between gap-2 md:block">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-[#273c55] truncate">
                        {item.complaint}
                      </p>
                      <p className="text-[13px] text-[#a0a7ae] mt-1">{item.id}</p>
                    </div>
                    {/* Status shown inline with the title on mobile, own column on md+ */}
                    <div className="md:hidden shrink-0">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 md:gap-0">
                    <span className="md:hidden text-[13px] font-bold text-[#a0a7ae]">Dept:</span>
                    <p className="text-[13px] text-[#4d5c6c]">{item.department}</p>
                  </div>
                  <div className="flex items-center gap-1 md:gap-0">
                    <span className="md:hidden text-[13px] font-bold text-[#a0a7ae]">Filed:</span>
                    <p className="text-[13px] text-[#4d5c6c]">{item.date}</p>
                  </div>
                  <div className="hidden md:flex items-center">
                    <StatusBadge status={item.status} />
                  </div>
                </button>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
};

function StatusBadge({ status }) {
  const styles = {
    Lodged: { bg: "bg-[#eef2f7]", text: "text-[#617086]" },
    "In progress": { bg: "bg-[#fff1d5]", text: "text-[#c18a20]" },
    Assigned: { bg: "bg-[#eef2f7]", text: "text-[#617086]" },
    Resolved: { bg: "bg-[#e1f3eb]", text: "text-[#398d70]" },
    Escalated: { bg: "bg-[#fbe4e4]", text: "text-[#c14747]" },
  };

  const current = styles[status] || styles.Assigned;

  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[13px] font-bold ${current.bg} ${current.text}`}
    >
      {status}
    </span>
  );
}

export default MyComplaints;
