import { useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { LayoutList, BarChart3, LogOut, ShieldCheck, Menu, X, Ban } from "lucide-react";

import { getToken, getStoredStaff, clearSession } from "../lib/adminApi";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const token = getToken();
  const staff = getStoredStaff();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  function handleLogout() {
    clearSession();
    navigate("/admin/login", { replace: true });
  }

  const navItem = (path, label, Icon) => (
    <button
      type="button"
      onClick={() => {
        navigate(path);
        setSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm cursor-pointer ${
        routerLocation.pathname === path
          ? "bg-white/15 text-white font-medium"
          : "text-white/80 hover:bg-white/10"
      }`}
    >
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );

  const sidebarContent = (closeButton) => (
    <>
      <div className="px-5 pt-6 pb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#f5a900] flex items-center justify-center shrink-0">
            <ShieldCheck size={19} className="text-[#17202a]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[18px] leading-tight truncate">
              Nagrik Sahayak
            </h1>
            <p className="text-[13px] text-white/60">Admin console</p>
          </div>
        </div>
        {closeButton}
      </div>

      <nav className="px-3 space-y-2">
        {navItem("/admin", "Complaints queue", LayoutList)}
        {navItem("/admin/analytics", "Analytics", BarChart3)}
        {staff?.role === "admin" && navItem("/admin/blocklist", "Blocked numbers", Ban)}
      </nav>

      <div className="mt-auto px-4 pb-5">
        <div className="px-2 mb-3 min-w-0">
          <p className="text-[15px] font-semibold truncate">{staff?.name}</p>
          <p className="text-[13px] text-white/60">
            {staff?.role === "admin" ? "Administrator" : "Department staff"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-semibold bg-white/10 hover:bg-white/15 cursor-pointer"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f6f7f8] flex">
      {/* Static sidebar - lg and up */}
      <aside className="hidden lg:flex w-[220px] shrink-0 bg-[#0d2338] text-white min-h-screen flex-col">
        {sidebarContent(null)}
      </aside>

      {/* Mobile off-canvas drawer - below lg */}
      <div className={`lg:hidden fixed inset-0 z-40 ${sidebarOpen ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setSidebarOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            sidebarOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-[240px] max-w-[80vw] h-full bg-[#0d2338] text-white flex flex-col transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent(
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </aside>
      </div>

      <main className="flex-1 min-w-0">
        {/* Mobile top bar with hamburger - the page content below still renders its own header/content */}
        <div className="lg:hidden sticky top-0 z-30 h-14 bg-white border-b border-[#e5e6e5] flex items-center px-4 gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#e5e6e5] hover:bg-[#f7f7f5] cursor-pointer"
          >
            <Menu size={16} className="text-[#0d2338]" />
          </button>
          <span className="text-[17px] font-bold text-[#0d2338] truncate">
            Nagrik Sahayak Admin
          </span>
        </div>

        {children}
      </main>
    </div>
  );
}
