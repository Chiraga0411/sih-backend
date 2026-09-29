import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";

import AdminLayout from "./AdminLayout";
import { listBlocklist, blockPhone, unblockPhone, getStoredStaff, ApiError } from "../lib/adminApi";
import { formatDate } from "../lib/format";

export default function AdminBlocklist() {
  const staff = getStoredStaff();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    listBlocklist()
      .then((res) => setItems(res.items || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the list."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // The API is admin-only; keep department staff out of the page too.
  if (staff && staff.role !== "admin") return <Navigate to="/admin" replace />;

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await blockPhone({ phone: phone.trim(), reason: reason.trim(), days: days ? Number(days) : undefined });
      setPhone("");
      setReason("");
      setDays("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not block this number.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(p) {
    if (!window.confirm(`Unblock ${p}?`)) return;
    try {
      await unblockPhone(p);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unblock this number.");
    }
  }

  const input = "h-9 rounded-lg border border-[#e1e4e7] px-3 text-[14px] outline-none";

  return (
    <AdminLayout>
      <div className="min-h-[70px] sm:h-[78px] bg-white border-b border-gray-100 flex flex-col justify-center px-4 sm:px-8 py-4 sm:py-0">
        <h2 className="text-[20px] sm:text-[22px] font-bold text-[#172033]">Blocked numbers</h2>
        <p className="text-[14px] text-gray-400 mt-0.5">Blocked numbers cannot request codes or submit complaints.</p>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        <form onSubmit={handleAdd} className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_120px_auto] gap-3">
          <input className={input} placeholder="Phone (10 digits)" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <input className={input} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
          <input className={input} type="number" min="1" placeholder="Days (blank = permanent)" value={days} onChange={(e) => setDays(e.target.value)} />
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-4 rounded-lg bg-[#203d63] text-white text-[14px] font-bold cursor-pointer disabled:opacity-60"
          >
            {saving ? "Blocking…" : "Block"}
          </button>
        </form>

        {error && <p className="text-[15px] font-semibold text-[#c94b4b]">{error}</p>}

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-[16px] text-gray-400">
              <Loader2 size={15} className="animate-spin" /> Loading…
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="text-center py-10 text-[16px] text-gray-400">No blocked numbers.</p>
          )}
          {!loading &&
            items.map((b) => (
              <div key={b.phone} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-50 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-[#273c55]">{b.phone}</p>
                  <p className="text-[13px] text-gray-400 truncate">
                    {b.reason} · {b.expiresAt ? `until ${formatDate(b.expiresAt)}` : "permanent"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(b.phone)}
                  className="shrink-0 h-8 px-3 rounded-lg bg-[#fdecec] text-[#b03a3a] text-[13px] font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={13} /> Unblock
                </button>
              </div>
            ))}
        </div>
      </div>
    </AdminLayout>
  );
}
