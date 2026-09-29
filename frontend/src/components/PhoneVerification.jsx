// Two-step phone verification (number -> 6-digit code). Calls onVerified(phone)
// once the server has accepted the code and the token is stored.
import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import Turnstile, { turnstileEnabled } from "./Turnstile";
import { requestOtp, verifyOtp, ApiError } from "../lib/api";
import { setAuth } from "../lib/storage";
import { useI18n } from "../lib/i18n";

const RESEND_SECONDS = 30;

export default function PhoneVerification({ initialPhone = "", onVerified }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone"); // phone | code
  const [captcha, setCaptcha] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState("");

  const onToken = useCallback((t) => setCaptcha(t), []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendCode() {
    if (turnstileEnabled && !captcha) {
      setError("Please complete the CAPTCHA check first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await requestOtp({ phone: phone.trim(), turnstileToken: captcha });
      setDevOtp(res.devOtp || ""); // only present in dev/demo mode
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    setError("");
    try {
      const res = await verifyOtp({ phone: phone.trim(), code: code.trim() });
      setAuth({ token: res.token, phone: res.citizen.phone });
      onVerified(res.citizen.phone);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "h-10 rounded-xl border border-[#e1e4e7] px-3 text-[15px] outline-none w-full";
  const btnCls =
    "h-10 px-4 rounded-xl bg-[#203d63] text-white text-[13px] font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2";

  return (
    <div className="bg-white border border-[#e2e5e8] rounded-2xl px-5 py-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-[#42627e]" />
        <p className="text-[13px] font-bold tracking-[0.12em] text-[#8a939d] uppercase">
          {t("Verify your phone number")}
        </p>
      </div>

      {step === "phone" ? (
        <>
          <input
            type="tel"
            inputMode="numeric"
            placeholder={t("10-digit mobile number")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
          />
          <Turnstile onToken={onToken} />
          <button type="button" onClick={sendCode} disabled={busy || !phone.trim()} className={`${btnCls} mt-3`}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : null}
            {t("Send code")}
          </button>
        </>
      ) : (
        <>
          <p className="text-[13px] text-[#6b7683] mb-2">{t("Enter the 6-digit code sent to")} {phone}.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${inputCls} tracking-[0.4em] text-center`}
          />
          {devOtp && (
            <p className="mt-2 text-[12px] text-[#b77b16]">{t("Demo mode — your code is")} {devOtp}</p>
          )}
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={confirmCode} disabled={busy || code.length !== 6} className={`${btnCls} flex-1`}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : null}
              {t("Verify")}
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy || cooldown > 0}
              className="h-10 px-4 rounded-xl border border-[#e1e4e7] text-[13px] font-bold text-[#4e5d6e] cursor-pointer disabled:opacity-50"
            >
              {cooldown > 0 ? `${t("Resend in")} ${cooldown}s` : t("Resend")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError("");
            }}
            className="mt-2 text-[12px] text-[#7d858e] underline cursor-pointer"
          >
            {t("Change number")}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-[13px] font-semibold text-[#c94b4b]">{t(error)}</p>}
    </div>
  );
}
