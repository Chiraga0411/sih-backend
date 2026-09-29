import { Bell, Menu, Search } from "lucide-react";
import { useI18n } from "../lib/i18n";

// `onMenuClick` shows a hamburger button below lg that opens the sidebar
// drawer (owned by the parent page, which also renders <Sidebar />).
function Topbar({ title, subtitle, onMenuClick }) {
  const { t } = useI18n();
  return (
    <div className="w-full px-4 sm:px-5 lg:px-7 pt-4 sm:pt-5 pb-4">
      <div className="flex items-start justify-between gap-3">
        {/* ================= LEFT SIDE ================= */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Hamburger - below lg only */}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-[#e5e6e5] cursor-pointer hover:bg-[#f7f7f5]"
            >
              <Menu size={16} className="text-[#34475c]" />
            </button>
          )}

          <div className="min-w-0">
            {title && (
              <h1 className="text-[20px] sm:text-[22px] lg:text-[24px] font-bold text-[#172b43] leading-6 truncate">
                {title}
              </h1>
            )}

            {subtitle && (
              <p className="text-[14px] sm:text-[15px] text-[#8a929a] mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* ================= RIGHT SIDE ================= */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* SEARCH - hidden below sm, shown from sm upward */}
          <div className="hidden sm:flex w-[140px] md:w-[190px] h-9 rounded-xl bg-white border border-[#e5e6e5] items-center px-3">
            <Search size={13} className="text-[#9aa1a8] shrink-0" />
            <input
              type="text"
              placeholder={t("Search complaints, IDs...")}
              className="flex-1 ml-2 min-w-0 bg-transparent outline-none text-[14px] text-[#34475c] placeholder:text-[#a0a6ac]"
            />
          </div>

          {/* Search icon button - mobile only, replaces the full search bar */}
          <button
            type="button"
            className="sm:hidden w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-[#f1f2f2]"
          >
            <Search size={15} className="text-[#687587]" />
          </button>

          {/* NOTIFICATION */}
          <button
            type="button"
            className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer hover:bg-[#f1f2f2]"
          >
            <Bell size={15} className="text-[#687587]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Topbar;
