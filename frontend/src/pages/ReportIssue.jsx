import React, { useEffect, useRef, useState } from "react";
import {
  LocateFixed,
  Mic,
  Send,
  Sparkles,
  Search,
  Loader2,
  ArrowRight,
  Play,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { intakeGrievance, intakeVoiceGrievance, ApiError } from "../lib/api";
import { getProfile, saveProfile } from "../lib/storage";
import PhoneVerification from "../components/PhoneVerification";
import { priorityFromUrgency } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { useSpeech, GREETING_TEXT, wasGreeted, markGreeted } from "../lib/speech";

// Codecs tried in preference order — browsers vary in what MediaRecorder
// supports; the backend accepts audio/webm, audio/ogg, audio/wav, audio/mp4
// (see uploadMiddleware.js ALLOWED_MIME_TYPES), so any of these works.
const PREFERRED_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"];

function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function Bubble({ from, children }) {
  const isUser = from === "user";
  return (
    <div className={`max-w-[85%] sm:max-w-[370px] mt-4 ${isUser ? "ml-auto" : ""}`}>
      <div
        className={`rounded-xl px-3 py-2.5 ${
          isUser
            ? "bg-[#073c62] text-white rounded-tr-md"
            : "bg-[#f1f3f3] text-[#4d5966] rounded-tl-md"
        }`}
      >
        <p className="text-[14px] leading-[20px]">{children}</p>
      </div>
    </div>
  );
}

function ReportIssue() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const prefill = routerLocation.state?.prefillText || "";

  const profile = getProfile();
  const language = profile.language || "Hindi";

  const [message, setMessage] = useState(prefill);
  const [chat, setChat] = useState([
    {
      from: "bot",
      text: GREETING_TEXT, // the same sentence the voice greeting speaks
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastText, setLastText] = useState("");
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [result, setResult] = useState(null); // last successful intake response
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceUnsupported, setVoiceUnsupported] = useState(false);
  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mimeTypeRef = useRef("");
  const pendingAudioRef = useRef(null); // voice note waiting for phone verification
  const [showVerify, setShowVerify] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat]);

  // ---- Voice greeting ----
  // Plays once per browser session per language. If the browser blocks autoplay
  // (e.g. the page was refreshed with no tap yet) the speaker button does it.
  const { status: voiceStatus, speak, stop: stopVoice, autoOff, setAutoOff } = useSpeech(language);

  useEffect(() => {
    if (autoOff || wasGreeted(language)) return undefined;
    let cancelled = false;
    speak(GREETING_TEXT).then((outcome) => {
      if (outcome === "played" && !cancelled) markGreeted(language);
    });
    return () => {
      cancelled = true;
      stopVoice();
    };
  }, [language, autoOff, speak, stopVoice]);

  async function runIntake(text, locationOverride) {
    setLoading(true);
    setError("");
    try {
      const res = await intakeGrievance({
        text,
        language,
        location: locationOverride ?? coords ?? undefined,
      });

      if (!res.complete) {
        setNeedsLocation(res.missingField === "location");
        setResult(res);
        setChat((c) => [
          ...c,
          {
            from: "bot",
            text:
              res.missingField === "location"
                ? "Can you share the exact location, or share your GPS pin?"
                : "Could you describe the issue in a bit more detail?",
          },
        ]);
      } else {
        setNeedsLocation(false);
        setResult(res);
        setChat((c) => [
          ...c,
          {
            from: "bot",
            text: "Got it — routing this to {dept}. Review the details on the right, then continue.",
            vars: { dept: res.departmentPreview?.name ? t(res.departmentPreview.name) : t("the right department") },
          },
        ]);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Something went wrong reaching the server.";
      setError(msg);
      setChat((c) => [...c, { from: "bot", text: msg, warn: true }]);
    } finally {
      setLoading(false);
    }
  }

  async function runVoiceIntake(audioBlob) {
    setLoading(true);
    setError("");
    try {
      const res = await intakeVoiceGrievance({
        audioBlob,
        filename: `voice-note.${mimeTypeRef.current.includes("mp4") ? "m4a" : "webm"}`,
        language,
        location: coords ?? undefined,
      });

      if (res.transcript) {
        setChat((c) => [...c, { from: "user", text: `🎤 "${res.transcript}"` }]);
        setLastText(res.transcript);
      }

      if (!res.complete) {
        setNeedsLocation(res.missingField === "location");
        setResult(res);
        setChat((c) => [
          ...c,
          {
            from: "bot",
            text:
              res.missingField === "location"
                ? "Can you share the exact location, or share your GPS pin?"
                : "Could you describe the issue in a bit more detail?",
          },
        ]);
      } else {
        setNeedsLocation(false);
        setResult(res);
        setChat((c) => [
          ...c,
          {
            from: "bot",
            text: "Got it — routing this to {dept}. Review the details on the right, then continue.",
            vars: { dept: res.departmentPreview?.name ? t(res.departmentPreview.name) : t("the right department") },
          },
        ]);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Voice input needs a verified phone. Keep the recording and retry after OTP.
        pendingAudioRef.current = audioBlob;
        setShowVerify(true);
        setChat((c) => [...c, { from: "bot", text: "Please verify your phone number to use voice input." }]);
        return;
      }
      const msg = err instanceof ApiError ? err.message : "Something went wrong reaching the server.";
      setError(msg);
      setChat((c) => [...c, { from: "bot", text: msg, warn: true }]);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    stopVoice(); // don't let the greeting talk over the microphone
    const mimeType = pickSupportedMimeType();
    if (mimeType === null) {
      setVoiceUnsupported(true);
      setError(t("Voice input isn't supported in this browser — please type instead."));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop()); // release the mic
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
        if (blob.size > 0) runVoiceIntake(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError("");
    } catch (err) {
      setError(t("Couldn't access the microphone — check your browser permissions."));
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function handleVerified(verifiedPhone) {
    saveProfile({ phone: verifiedPhone });
    setShowVerify(false);
    const blob = pendingAudioRef.current;
    pendingAudioRef.current = null;
    if (blob) runVoiceIntake(blob); // resend the recording that was waiting
  }

  function handleMicClick() {
    if (loading) return;
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function handleSend() {
    const text = message.trim();
    if (!text || loading) return;
    stopVoice();
    setChat((c) => [...c, { from: "user", text }]);
    setLastText(text);
    setMessage("");
    runIntake(text);
  }

  function handleShareLocation() {
    if (!navigator.geolocation) {
      setError(t("Location isn't available in this browser."));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCoords(loc);
        setLocating(false);
        setChat((c) => [
          ...c,
          { from: "user", text: "📍 Shared current location", translate: true },
        ]);
        runIntake(lastText, loc);
      },
      () => {
        setLocating(false);
        setError(t("Couldn't get your location — check location permissions."));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleContinue() {
    if (!result?.complete) return;
    navigate("/report/review", {
      state: {
        text: lastText,
        language,
        location: coords,
        addressText: result.classification?.entities?.locationText || "",
        classification: result.classification,
        departmentPreview: result.departmentPreview,
      },
    });
  }

  const classification = result?.classification;

  return (
    <div className="h-screen w-full bg-[#f7f7f5] flex overflow-hidden">
      {showVerify && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-[420px]">
            <PhoneVerification initialPhone={profile.phone} onVerified={handleVerified} />
            <button
              type="button"
              onClick={() => {
                setShowVerify(false);
                pendingAudioRef.current = null;
              }}
              className="mt-3 w-full text-[13px] font-bold text-white underline cursor-pointer"
            >
              {t("Cancel — I'll type instead")}
            </button>
          </div>
        </div>
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title={t("New complaint")}
          subtitle={t("Nagrik Sahayak AI Assistant")}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="flex-1 min-h-0 px-4 sm:px-5 lg:px-7 pb-6 overflow-y-auto lg:overflow-hidden">
          <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4 lg:h-full">
            {/* ================= CHAT ================= */}
            {/* Fixed scrollable height below lg (own scroll area per capsule note); fills the row on lg+ */}
            <div className="bg-white border border-[#e4e6e7] rounded-2xl flex flex-col h-[60vh] lg:h-auto lg:min-h-0 overflow-hidden">
              {/* Voice greeting controls */}
              <div className="flex items-center justify-end gap-2 px-4 pt-3">
                <button
                  type="button"
                  onClick={() => setAutoOff(!autoOff)}
                  title={autoOff ? t("Turn on voice greeting") : t("Turn off voice greeting")}
                  className="h-8 px-3 rounded-full bg-[#f1f3f3] text-[#53667a] text-[12px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {autoOff ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  {autoOff ? t("Voice: off") : t("Voice: on")}
                </button>
                <button
                  type="button"
                  onClick={() => (voiceStatus === "playing" || voiceStatus === "loading" ? stopVoice() : speak(GREETING_TEXT))}
                  title={
                    voiceStatus === "playing" || voiceStatus === "loading"
                      ? t("Stop")
                      : t("Listen to the greeting")
                  }
                  aria-label={t("Listen to the greeting")}
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${
                    voiceStatus === "blocked" ? "bg-[#f5a900] animate-pulse" : "bg-[#f1f3f3]"
                  }`}
                >
                  {voiceStatus === "loading" ? (
                    <Loader2 size={14} className="animate-spin text-[#172b43]" />
                  ) : voiceStatus === "playing" ? (
                    <Square size={12} className="text-[#172b43]" />
                  ) : (
                    <Play size={13} className="text-[#172b43]" />
                  )}
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 px-5 pb-5 pt-2 overflow-y-auto">
                {chat.map((m, i) => (
                  <Bubble key={i} from={m.from}>
                    {m.warn ? "⚠ " : ""}
                    {m.from === "bot" || m.translate ? t(m.text, m.vars) : m.text}
                  </Bubble>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 mt-4 text-[14px] text-[#8b939c]">
                    <Loader2 size={12} className="animate-spin" />
                    {t("Thinking…")}
                  </div>
                )}

                {needsLocation && (
                  <button
                    type="button"
                    onClick={handleShareLocation}
                    disabled={locating}
                    className="mt-3 h-8 px-3 rounded-full bg-[#e4f4ed] text-[#29906f] text-[13px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <LocateFixed size={11} />
                    {locating ? t("Getting location…") : t("Share current location")}
                  </button>
                )}
              </div>

              {/* ================= INPUT ================= */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder={t("Type a message...")}
                    className="flex-1 h-10 rounded-full bg-[#f5f5f4] border border-[#e6e7e7] px-4 outline-none text-[14px] text-[#35475b] placeholder:text-[#9aa1a8]"
                  />

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading || !message.trim()}
                    title={t("Send")}
                    className="w-10 h-10 rounded-full bg-[#f5a900] flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <Send size={16} className="text-[#172b43]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={loading || voiceUnsupported}
                    title={
                      voiceUnsupported
                        ? t("Voice input isn't supported in this browser")
                        : recording
                        ? t("Stop recording")
                        : t("Speak your complaint")
                    }
                    className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      recording ? "bg-red-500 animate-pulse" : "bg-[#f1f3f3]"
                    }`}
                  >
                    <Mic size={16} className={recording ? "text-white" : "text-[#172b43]"} />
                  </button>
                </div>
              </div>
            </div>

            {/* ================= RIGHT AI CARD ================= */}
            <div className="flex flex-col gap-3">
              <div className="bg-white border border-[#d9dce0] rounded-2xl p-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} className="text-[#53667a]" />
                  <p className="text-[14px] font-bold text-[#35475b]">
                    {t("AI is building this live")}
                  </p>
                </div>

                <Field label={t("ISSUE")} value={classification?.issueType} />
                <Field
                  label={t("DEPARTMENT")}
                  value={result?.departmentPreview?.name ? t(result.departmentPreview.name) : undefined}
                />
                <Field
                  label={t("LOCATION")}
                  value={
                    classification?.entities?.locationText ||
                    (coords ? t("GPS location shared") : undefined)
                  }
                />

                <div className="mt-4">
                  <p className="text-[12px] font-bold tracking-[0.12em] text-[#8b939c]">
                    {t("PRIORITY")}
                  </p>
                  <span className="inline-flex mt-1 px-2 py-1 rounded-full bg-[#fff0d2] text-[#c28a1b] text-[13px] font-bold">
                    {t(priorityFromUrgency(classification?.urgencyLevel))}
                  </span>
                </div>
              </div>

              <div className="bg-[#e5f5ef] border border-[#d8eee6] rounded-xl px-3 py-3">
                <div className="flex items-start gap-2">
                  <Search size={11} className="text-[#37947a] mt-[1px]" />
                  <p className="text-[13px] leading-3 text-[#37947a] font-semibold">
                    {t("Duplicate check runs automatically once you confirm and submit.")}
                  </p>
                </div>
              </div>

              {result?.complete && (
                <button
                  type="button"
                  onClick={handleContinue}
                  className="h-11 rounded-xl bg-[#203d63] text-white flex items-center justify-center gap-2 text-[14px] font-bold cursor-pointer hover:bg-[#1a3455]"
                >
                  {t("Continue to review")}
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="mt-4">
      <p className="text-[12px] font-bold tracking-[0.12em] text-[#8b939c]">
        {label}
      </p>
      <p className="text-[14px] font-bold text-[#35475b] mt-1">
        {value || "—"}
      </p>
    </div>
  );
}

export default ReportIssue;
