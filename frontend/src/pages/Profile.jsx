import React, { useState } from "react";
import { Edit3, Globe2, MapPin, ShieldCheck, User, Phone, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { getProfile, saveProfile } from "../lib/storage";
import { useI18n } from "../lib/i18n";

const Profile = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState(getProfile());
  const [draft, setDraft] = useState(profile);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleSave() {
    const saved = saveProfile(draft);
    setProfile(saved);
    setEditing(false);
  }

  const initial = (profile.name || "?")[0].toUpperCase();

  return (
    <div className="h-screen w-full bg-[#f7f7f5] flex overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title={t("Profile")}
          subtitle={t("Manage your account and preferences")}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 lg:px-7 pb-8">
          <div className="max-w-[900px]">
            {/* ACCOUNT CARD */}
            <div className="bg-white border border-[#e4e6e8] rounded-2xl px-4 sm:px-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full bg-[#fff0d2] flex items-center justify-center">
                  <span className="text-[23px] font-bold text-[#c58c1d]">
                    {initial}
                  </span>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-[#263b53]">
                    {profile.name || t("Add your name")}
                  </p>
                  <p className="text-[13px] text-[#8b949f] mt-1">
                    {t("Citizen — no account or login required")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (editing) {
                    handleSave();
                  } else {
                    setDraft(profile);
                    setEditing(true);
                  }
                }}
                className="h-9 px-4 rounded-xl border border-[#e1e4e7] bg-white flex items-center gap-2 text-[13px] font-bold text-[#536275] cursor-pointer hover:bg-[#fafafa]"
              >
                {editing ? <Save size={13} /> : <Edit3 size={13} />}
                {editing ? t("Save") : t("Edit")}
              </button>
            </div>

            {/* PERSONAL DETAILS */}
            <div className="mt-5 bg-white border border-[#e4e6e8] rounded-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <p className="text-[13px] font-bold tracking-[0.13em] text-[#697686]">
                  {t("PERSONAL DETAILS")}
                </p>
              </div>

              {editing ? (
                <div className="px-5 pb-5 space-y-3">
                  <EditRow icon={User} label={t("Name")}>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className="h-9 w-full rounded-lg border border-[#e1e4e7] px-3 text-[15px] outline-none"
                    />
                  </EditRow>
                  <EditRow icon={Phone} label={t("Phone")}>
                    <input
                      type="tel"
                      value={draft.phone}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                      className="h-9 w-full rounded-lg border border-[#e1e4e7] px-3 text-[15px] outline-none"
                    />
                  </EditRow>
                  <EditRow icon={MapPin} label={t("Location")}>
                    <input
                      type="text"
                      value={draft.location}
                      onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                      className="h-9 w-full rounded-lg border border-[#e1e4e7] px-3 text-[15px] outline-none"
                    />
                  </EditRow>
                </div>
              ) : (
                <>
                  <ProfileRow icon={User} label={t("Name")} value={profile.name || "—"} />
                  <ProfileRow icon={Phone} label={t("Phone")} value={profile.phone || "—"} />
                  <ProfileRow
                    icon={MapPin}
                    label={t("Location")}
                    value={profile.location || "—"}
                  />
                </>
              )}

              {/* ACCOUNT STATUS */}
              <div className="px-5 py-5 border-t border-[#eef0f1]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[#f2f4f6] flex items-center justify-center">
                      <ShieldCheck size={16} className="text-[#667587]" />
                    </div>
                    <div>
                      <p className="text-[13px] text-[#8a939d]">{t("Account status")}</p>
                      <p className="text-[14px] font-bold text-[#34475b] mt-1">
                        {t("Identified by phone number")}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#e3f4ec] text-[#398c70] text-[13px] font-bold">
                    {profile.phone ? t("Set up") : t("Not set up")}
                  </span>
                </div>
              </div>
            </div>

            {/* PREFERENCES */}
            <div className="mt-5 bg-white border border-[#e4e6e8] rounded-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <p className="text-[13px] font-bold tracking-[0.13em] text-[#697686]">
                  {t("PREFERENCES")}
                </p>
              </div>

              <div className="px-5 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[#f2f4f6] flex items-center justify-center">
                      <Globe2 size={16} className="text-[#667587]" />
                    </div>
                    <div>
                      <p className="text-[13px] text-[#8a939d]">{t("Language")}</p>
                      <p className="text-[14px] font-bold text-[#34475b] mt-1">
                        {t("Choose your preferred language")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="text-[13px] font-bold text-[#536275] flex items-center gap-2 cursor-pointer"
                  >
                    {profile.language || "Hindi"}
                    <span className="text-[#9ca3aa]">→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

function ProfileRow({ icon: Icon, label, value }) {
  return (
    <div className="px-5 py-5 border-t border-[#eef0f1]">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-[#f2f4f6] flex items-center justify-center shrink-0">
          <Icon size={16} className="text-[#667587]" />
        </div>
        <div>
          <p className="text-[13px] text-[#8a939d]">{label}</p>
          <p className="text-[14px] font-bold text-[#34475b] mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EditRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-[#f2f4f6] flex items-center justify-center shrink-0">
        <Icon size={16} className="text-[#667587]" />
      </div>
      <div className="flex-1">
        <p className="text-[13px] text-[#8a939d] mb-1">{label}</p>
        {children}
      </div>
    </div>
  );
}

export default Profile;
