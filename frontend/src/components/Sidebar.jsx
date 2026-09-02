import {
  Home as HomeIcon,
  Mic,
  List,
  User,
  Globe,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { getProfile } from "../lib/storage";

const navigation = [
  {
    name: "Home",
    path: "/home",
    icon: HomeIcon,
  },
  {
    name: "Report an issue",
    path: "/report",
    icon: Mic,
  },
  {
    name: "Track complaints",
    path: "/track",
    icon: List,
  },
  {
    name: "Profile",
    path: "/profile",
    icon: User,
  },
];

// `open` / `onClose` control the mobile off-canvas drawer (< lg breakpoint).
// On lg+ screens the sidebar is always visible as a static column and these
// props have no visual effect.
function Sidebar({ open = false, onClose = () => {} }) {
  const profile = getProfile();
  const initial = (profile.name || "?")[0].toUpperCase();

  const content = (
    <>
      {/* Logo */}
      <div className="px-4 pt-5 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#f5a900] flex items-center justify-center shrink-0">
            <Mic size={18} strokeWidth={2.5} />
          </div>

          <div>
            <h1 className="text-[18px] font-bold leading-4">
              Nagrik Sahayak
            </h1>

            <p className="text-[13px] text-white/50 mt-0.5">
              नागरिक सहायक
            </p>
          </div>
        </div>

        {/* Close button - mobile drawer only */}
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-2 flex-1">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[17px] font-semibold cursor-pointer transition-none ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon size={16} strokeWidth={2} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-4">
        {/* Language */}
        <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 text-white/80 text-[16px] font-semibold cursor-pointer">
          <Globe size={14} />
          <span>हिंदी / Hindi</span>
        </button>

        {/* User */}
        <div className="mt-3 flex items-center gap-2.5 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[#fff1d4] text-[#d69a16] flex items-center justify-center text-xs font-bold shrink-0">
            {initial}
          </div>

          <div className="min-w-0">
            <p className="text-[16px] font-bold truncate">
              {profile.name || "Add your name"}
            </p>
            <p className="text-[13px] text-white/45 truncate">
              {profile.location || "Add your location"}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Static sidebar - visible from lg upward */}
      <aside className="hidden lg:flex w-[190px] min-w-[190px] h-screen bg-[#203d63] text-white flex-col">
        {content}
      </aside>

      {/* Mobile off-canvas drawer - below lg */}
      <div
        className={`lg:hidden fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Drawer panel */}
        <aside
          className={`absolute inset-y-0 left-0 w-[240px] max-w-[80vw] h-full bg-[#203d63] text-white flex flex-col transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {content}
        </aside>
      </div>
    </>
  );
}

export default Sidebar;
