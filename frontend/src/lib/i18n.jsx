// src/lib/i18n.jsx
// Interface translation powered by Sarvam Translate (through our backend).
//
// How it works
//   - The English text is the key:   t("Report an issue")
//   - Language = English  -> text is shown as written, no network calls.
//   - Any other language  -> t() returns the cached translation if we have it,
//     otherwise English for a moment while the missing strings are collected,
//     sent to POST /api/i18n/translate in one batch, and cached in this
//     browser (localStorage) so later visits are instant.
//   - If the backend/Sarvam is down, the UI simply stays in English.
//
// Use inside any component:
//   const { t } = useI18n();
//   <h1>{t("Home")}</h1>
//   t("Got it — routing this to {dept}.", { dept: "Water" })

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getProfile, saveProfile } from "./storage";

// Same base URL logic as lib/api.js
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://sih-backend-01.onrender.com/api";

// name = what we store and send to the backend; code = <html lang> value.
export const LANGUAGES = [
  { name: "Hindi", native: "हिंदी", code: "hi" },
  { name: "English", native: "English", code: "en" },
  { name: "Marathi", native: "मराठी", code: "mr" },
  { name: "Tamil", native: "தமிழ்", code: "ta" },
  { name: "Bengali", native: "বাংলা", code: "bn" },
  { name: "Punjabi", native: "ਪੰਜਾਬੀ", code: "pa" },
];

const CACHE_PREFIX = "nagrik_ui_tr_v1_";
const BATCH_SIZE = 50; // backend accepts up to 60
const FLUSH_DELAY_MS = 60;

const interpolate = (text, vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : text;

function loadCache(language) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + language)) || {};
  } catch {
    return {};
  }
}

function saveCache(language, map) {
  try {
    localStorage.setItem(CACHE_PREFIX + language, JSON.stringify(map));
  } catch {
    /* storage full or blocked — translations still work for this session */
  }
}

async function fetchTranslations(language, texts) {
  const res = await fetch(`${API_BASE_URL}/i18n/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, texts }),
  });
  if (!res.ok) throw new Error(`translate failed: ${res.status}`);
  const body = await res.json();
  return body?.translations || {};
}

const I18nContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => getProfile().language || "Hindi");
  // Cache is stored together with the language it belongs to, so switching
  // language never flashes the previous language's text.
  const [store, setStore] = useState(() => {
    const lang = getProfile().language || "Hindi";
    return { lang, map: loadCache(lang) };
  });

  // Per language: strings waiting to be sent, and strings already requested
  // this session (so a failed request is not retried in a render loop).
  const pending = useRef({});
  const asked = useRef({});
  const timer = useRef(null);
  const langRef = useRef(language);
  langRef.current = language;

  const translations = useMemo(
    () => (store.lang === language ? store.map : loadCache(language)),
    [store, language]
  );

  useEffect(() => {
    document.documentElement.lang = LANGUAGES.find((l) => l.name === language)?.code || "en";
  }, [language]);

  const flush = useCallback(async () => {
    const lang = langRef.current;
    const texts = [...(pending.current[lang] || [])];
    pending.current[lang] = new Set();
    if (!texts.length || lang === "English") return;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const chunk = texts.slice(i, i + BATCH_SIZE);
      try {
        const got = await fetchTranslations(lang, chunk);
        if (langRef.current !== lang) return; // user switched language meanwhile
        if (Object.keys(got).length) {
          setStore((prev) => {
            const base = prev.lang === lang ? prev.map : loadCache(lang);
            const next = { ...base, ...got };
            saveCache(lang, next);
            return { lang, map: next };
          });
        }
      } catch (err) {
        console.warn("[i18n] translation unavailable, showing English:", err.message);
      }
    }
  }, []);

  const queue = useCallback(
    (text) => {
      const lang = langRef.current;
      const askedSet = (asked.current[lang] ||= new Set());
      if (askedSet.has(text)) return;
      askedSet.add(text);
      (pending.current[lang] ||= new Set()).add(text);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, FLUSH_DELAY_MS);
    },
    [flush]
  );

  const setLanguage = useCallback((name) => {
    saveProfile({ language: name });
    setLanguageState(name);
  }, []);

  const value = useMemo(() => {
    const t = (text, vars) => {
      if (!text || typeof text !== "string") return text;
      if (language === "English") return interpolate(text, vars);
      const hit = translations[text];
      if (hit === undefined) queue(text);
      return interpolate(hit ?? text, vars);
    };
    return {
      language,
      languageMeta: LANGUAGES.find((l) => l.name === language) || LANGUAGES[0],
      setLanguage,
      t,
    };
  }, [language, translations, queue, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}

export default useI18n;
