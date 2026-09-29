// src/lib/speech.js
// Plays the spoken greeting (Sarvam Text-to-Speech, through our backend).
//
//   const { status, speak, stop, autoOff, setAutoOff } = useSpeech(language);
//   speak(GREETING_TEXT)  -> "played" | "blocked" | "error" | "cancelled"
//
// status: idle | loading | playing | blocked | error
//   "blocked" = the browser refused autoplay (no tap yet); the speaker button fixes it.

import { useCallback, useEffect, useRef, useState } from "react";

// Same base URL logic as lib/api.js and lib/i18n.jsx
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://sih-backend-01.onrender.com/api";

// Must match GREETING_TEXT in backend/src/services/ttsService.js exactly —
// the backend only speaks sentences on its allowlist.
export const GREETING_TEXT =
  "Welcome to Nagrik Sahayak. Please tell me your problem. You can type, or tap the mic and speak.";

const AUTO_OFF_KEY = "nagrik_voice_greeting_off";

const readFlag = (store, key) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};
const writeFlag = (store, key, value) => {
  try {
    store.setItem(key, value);
  } catch {
    /* storage blocked — worst case the greeting plays again */
  }
};

/** Has the greeting already played in this browser session for this language? */
export const wasGreeted = (language) => readFlag(sessionStorage, `nagrik_greeted_${language}`) === "1";
export const markGreeted = (language) => writeFlag(sessionStorage, `nagrik_greeted_${language}`, "1");

export function useSpeech(language) {
  const [status, setStatus] = useState("idle");
  const [autoOff, setAutoOffState] = useState(() => readFlag(localStorage, AUTO_OFF_KEY) === "1");

  const audioRef = useRef(null);
  const abortRef = useRef(null);
  const urlsRef = useRef(new Map()); // "language|text" -> object URL (replay without a network call)
  const runRef = useRef(0); // bumps on every speak()/stop() so stale async work can tell it was superseded

  const stop = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    setStatus("idle");
  }, []);

  const speak = useCallback(
    async (text) => {
      stop();
      const run = runRef.current;
      setStatus("loading");

      try {
        const cacheKey = `${language}|${text}`;
        let url = urlsRef.current.get(cacheKey);

        if (!url) {
          const controller = new AbortController();
          abortRef.current = controller;
          const qs = new URLSearchParams({ language, text });
          // cache: "no-cache" = always re-check with the server, even if the browser still
          // holds an older copy of this URL (so a changed voice/pace is heard right away).
          const res = await fetch(`${API_BASE_URL}/i18n/speak?${qs}`, {
            signal: controller.signal,
            cache: "no-cache",
          });
          if (!res.ok) throw new Error(`speak failed: ${res.status}`);
          const blob = await res.blob();
          if (runRef.current !== run) return "cancelled";
          url = URL.createObjectURL(blob);
          urlsRef.current.set(cacheKey, url);
        }

        if (runRef.current !== run) return "cancelled";

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          if (runRef.current === run) setStatus("idle");
        };
        audio.onerror = () => {
          if (runRef.current === run) setStatus("error");
        };

        await audio.play();
        if (runRef.current !== run) return "cancelled";
        setStatus("playing");
        return "played";
      } catch (err) {
        if (err?.name === "AbortError" || runRef.current !== run) return "cancelled";
        if (err?.name === "NotAllowedError") {
          setStatus("blocked"); // autoplay refused — waiting for a tap
          return "blocked";
        }
        console.warn("[speech] greeting unavailable:", err.message);
        setStatus("error");
        return "error";
      }
    },
    [language, stop]
  );

  const setAutoOff = useCallback(
    (off) => {
      writeFlag(localStorage, AUTO_OFF_KEY, off ? "1" : "0");
      setAutoOffState(off);
      if (off) stop();
    },
    [stop]
  );

  // Leaving the page: silence and release the audio.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      runRef.current += 1;
      abortRef.current?.abort();
      audioRef.current?.pause();
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  return { status, speak, stop, autoOff, setAutoOff };
}

export default useSpeech;
