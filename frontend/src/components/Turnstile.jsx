// Cloudflare Turnstile widget. Renders nothing (and reports no token) when
// VITE_TURNSTILE_SITE_KEY isn't set, matching the backend which then skips
// the CAPTCHA check — so local dev and demos work with no Cloudflare account.
import { useEffect, useRef } from "react";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let el = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (!el) {
      el = document.createElement("script");
      el.src = SCRIPT_SRC;
      el.async = true;
      document.head.appendChild(el);
    }
    el.addEventListener("load", resolve, { once: true });
    el.addEventListener("error", reject, { once: true });
  });
}

export const turnstileEnabled = Boolean(SITE_KEY);

export default function Turnstile({ onToken }) {
  const ref = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (widgetId.current != null && window.turnstile) window.turnstile.remove(widgetId.current);
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="mt-3" />;
}
