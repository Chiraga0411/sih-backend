import React, { useEffect, useRef, useState } from "react";
import {
  LocateFixed,
  Mic,
  Send,
  Sparkles,
  Search,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { intakeGrievance, intakeVoiceGrievance, ApiError } from "../lib/api";
import { getProfile } from "../lib/storage";
import { priorityFromUrgency } from "../lib/format";

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
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const prefill = routerLocation.state?.prefillText || "";

  const profile = getProfile();
  const language = profile.language || "Hindi";

  const [message, setMessage] = useState(prefill);
  const [chat, setChat] = useState([
    {
      from: "bot",
      text: "नमस्ते! Tell me what's wrong — you can type or click the mic to speak.",
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat]);

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
            text: `Got it — routing this to ${
              res.departmentPreview?.name || "the right department"
            }. Review the details on the right, then continue.`,
          },
        ]);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Something went wrong reaching the server.";
      setError(msg);
      setChat((c) => [...c, { from: "bot", text: `⚠ ${msg}` }]);
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
            text: `Got it — routing this to ${
              res.departmentPreview?.name || "the right department"
            }. Review the details on the right, then continue.`,
          },
        ]);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong reaching the server.";
      setError(msg);
      setChat((c) => [...c, { from: "bot", text: `⚠ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    const mimeType = pickSupportedMimeType();
    if (mimeType === null) {
      setVoiceUnsupported(true);
      setError("Voice input isn't supported in this browser — please type instead.");
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
      setError("Couldn't access the microphone — check your browser permissions.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
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
    setChat((c) => [...c, { from: "user", text }]);
    setLastText(text);
    setMessage("");
    runIntake(text);
  }

  function handleShareLocation() {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser.");
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
          { from: "user", text: "📍 Shared current location" },
        ]);
        runIntake(lastText, loc);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location — check location permissions.");
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
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          title="New complaint"
          subtitle="Nagrik Sahayak AI Assistant"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="flex-1 min-h-0 px-4 sm:px-5 lg:px-7 pb-6 overflow-y-auto lg:overflow-hidden">
          <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4 lg:h-full">
            {/* ================= CHAT ================= */}
            {/* Fixed scrollable height below lg (own scroll area per capsule note); fills the row on lg+ */}
            <div className="bg-white border border-[#e4e6e7] rounded-2xl flex flex-col h-[60vh] lg:h-auto lg:min-h-0 overflow-hidden">
              <div ref={scrollRef} className="flex-1 p-5 overflow-y-auto">
                {chat.map((m, i) => (
                  <Bubble key={i} from={m.from}>
                    {m.text}
                  </Bubble>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 mt-4 text-[14px] text-[#8b939c]">
                    <Loader2 size={12} className="animate-spin" />
                    Thinking…
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
                    {locating ? "Getting location…" : "Share current location"}
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
                    placeholder="Type a message..."
                    className="flex-1 h-10 rounded-full bg-[#f5f5f4] border border-[#e6e7e7] px-4 outline-none text-[14px] text-[#35475b] placeholder:text-[#9aa1a8]"
                  />

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading || !message.trim()}
                    title="Send"
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
                        ? "Voice input isn't supported in this browser"
                        : recording
                        ? "Stop recording"
                        : "Speak your complaint"
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
                    AI is building this live
                  </p>
                </div>

                <Field label="ISSUE" value={classification?.issueType} />
                <Field
                  label="DEPARTMENT"
                  value={result?.departmentPreview?.name}
                />
                <Field
                  label="LOCATION"
                  value={
                    classification?.entities?.locationText ||
                    (coords ? "GPS location shared" : undefined)
                  }
                />

                <div className="mt-4">
                  <p className="text-[12px] font-bold tracking-[0.12em] text-[#8b939c]">
                    PRIORITY
                  </p>
                  <span className="inline-flex mt-1 px-2 py-1 rounded-full bg-[#fff0d2] text-[#c28a1b] text-[13px] font-bold">
                    {priorityFromUrgency(classification?.urgencyLevel)}
                  </span>
                </div>
              </div>

              <div className="bg-[#e5f5ef] border border-[#d8eee6] rounded-xl px-3 py-3">
                <div className="flex items-start gap-2">
                  <Search size={11} className="text-[#37947a] mt-[1px]" />
                  <p className="text-[13px] leading-3 text-[#37947a] font-semibold">
                    Duplicate check runs automatically once you confirm and
                    submit.
                  </p>
                </div>
              </div>

              {result?.complete && (
                <button
                  type="button"
                  onClick={handleContinue}
                  className="h-11 rounded-xl bg-[#203d63] text-white flex items-center justify-center gap-2 text-[14px] font-bold cursor-pointer hover:bg-[#1a3455]"
                >
                  Continue to review
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
