import { useState } from "react";
import {
  Mic,
  Sparkles,
  Activity,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { saveProfile, getProfile } from "../lib/storage";

const languages = [
  {
    native: "हिंदी",
    english: "Hindi",
  },
  {
    native: "English",
    english: "English",
  },
  {
    native: "मराठी",
    english: "Marathi",
  },
  {
    native: "தமிழ்",
    english: "Tamil",
  },
  {
    native: "বাংলা",
    english: "Bengali",
  },
  {
    native: "ਪੰਜਾਬੀ",
    english: "Punjabi",
  },
];

function Language() {
  const navigate = useNavigate();

  const [selectedLanguage, setSelectedLanguage] = useState(
    () => getProfile().language || "Hindi"
  );

  const handleContinue = () => {
    // Persisted locally and sent as `language` on every grievance
    // intake/submission call (see src/lib/api.js).
    saveProfile({ language: selectedLanguage });

    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-[#eef0ed] flex items-center justify-center">

      <div className="w-full min-h-screen md:min-h-[calc(100vh-32px)] md:max-w-[1400px] overflow-hidden md:rounded-2xl bg-[#f7f7f5] flex flex-col md:flex-row">

        {/* ================= LEFT PANEL ================= */}

        <section className="w-full md:w-[46%] bg-[#203d63] text-white px-8 py-10 md:px-12 md:py-14 flex flex-col justify-between">

          {/* Branding */}
          <div>

            {/* Microphone logo */}
            <div className="w-11 h-11 rounded-xl bg-[#f5a900] flex items-center justify-center mb-6">
              <Mic
                size={22}
                strokeWidth={2.5}
                className="text-[#172b43]"
              />
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-[46px] font-bold tracking-tight leading-none">
              Nagrik Sahayak
            </h1>

            {/* Hindi */}
            <p className="text-sm text-white/50 mt-3">
              नागरिक सहायक
            </p>

            {/* Description */}
            <p className="max-w-[390px] text-sm md:text-[19px] leading-5 text-white/65 mt-1">
              A multilingual, voice-first assistant for lodging and
              tracking civic grievances across every department,
              in your own language.
            </p>

          </div>

          {/* Features */}
          <div className="space-y-4 mt-10 md:mt-0">

            <Feature
              icon={<Mic size={14} />}
              text="Speak in any regional language"
            />

            <Feature
              icon={<Sparkles size={14} />}
              text="AI classifies and routes automatically"
            />

            <Feature
              icon={<Activity size={14} />}
              text="Real-time status until resolution"
            />

          </div>

        </section>

        {/* ================= RIGHT PANEL ================= */}

        <section className="w-full md:w-[54%] bg-[#f7f7f5] flex items-center justify-center px-6 py-12 md:px-16">

          <div className="w-full max-w-[500px]">

            {/* Heading */}
            <p className="text-xs font-bold tracking-[0.12em] text-[#647080] uppercase mb-5">
              Choose your language / भाषा चुनें
            </p>

            {/* Language cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {languages.map((language) => {

                const isSelected =
                  selectedLanguage === language.english;

                return (
                  <button
                    key={language.english}
                    type="button"
                    onClick={() =>
                      setSelectedLanguage(language.english)
                    }
                    className={`
                      h-[70px]
                      rounded-2xl
                      border
                      text-left
                      px-5
                      cursor-pointer
                      ${
                        isSelected
                          ? "bg-[#203d63] border-[#203d63] text-white"
                          : "bg-white border-[#e5e6e5] text-[#1d2d43] hover:border-[#cfd4d8]"
                      }
                    `}
                  >

                    <div className="text-[24px] font-bold leading-5">
                      {language.native}
                    </div>

                    <div
                      className={`
                        text-xs mt-1
                        ${
                          isSelected
                            ? "text-white/60"
                            : "text-[#8a9199]"
                        }
                      `}
                    >
                      {language.english}
                    </div>

                  </button>
                );
              })}

            </div>

            {/* Automatic language detection */}
            <div className="mt-5 rounded-xl bg-[#fff1d4] px-4 py-3">

              <div className="flex items-start gap-2">

                <Sparkles
                  size={15}
                  className="text-[#d79a19] mt-0.5 shrink-0"
                />

                <p className="text-xs font-semibold text-[#b18120] leading-4">
                  You can also just speak — we detect your
                  language automatically.
                </p>

              </div>

            </div>

            {/* Continue */}
            <button
              type="button"
              onClick={handleContinue}
              className="
                mt-5
                w-full
                h-[50px]
                rounded-xl
                bg-[#f5a900]
                text-[#172b43]
                font-bold
                flex
                items-center
                justify-center
                gap-2
                cursor-pointer
                hover:bg-[#e9a000]
              "
            >
              Continue

              <ChevronRight
                size={18}
                strokeWidth={2.5}
              />

            </button>

          </div>

        </section>

      </div>

    </div>
  );
}


/* ================= FEATURE ITEM ================= */

function Feature({ icon, text }) {
  return (
    <div className="flex items-center gap-3">

      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-[#f5a900]">
        {icon}
      </div>

      <span className="text-sm text-white/70">
        {text}
      </span>

    </div>
  );
}

export default Language;