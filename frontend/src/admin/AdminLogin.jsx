import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";

import { login, setSession, getToken } from "../lib/adminApi";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (getToken()) {
    navigate("/admin", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await login(email.trim(), password);
      setSession(res.token, res.staff);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d2338] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[380px] bg-white rounded-2xl p-6 sm:p-8 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#0d2338] flex items-center justify-center">
            <ShieldCheck size={19} className="text-white" />
          </div>
          <div>
            <h1 className="text-[19px] font-bold text-[#172033]">
              Nagrik Sahayak
            </h1>
            <p className="text-[14px] text-[#8b939c]">Staff / Admin sign-in</p>
          </div>
        </div>

        <label className="text-[14px] font-bold text-[#536275]">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@nagriksahayak.gov.in"
          className="mt-1 mb-4 h-10 w-full rounded-lg border border-[#e1e4e7] px-3 text-[16px] outline-none"
        />

        <label className="text-[14px] font-bold text-[#536275]">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-1 mb-2 h-10 w-full rounded-lg border border-[#e1e4e7] px-3 text-[16px] outline-none"
        />

        {error && (
          <p className="text-[14px] font-semibold text-[#c94b4b] mt-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 h-11 w-full rounded-xl bg-[#f5a900] text-[#17202a] text-[16px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </div>
  );
}
