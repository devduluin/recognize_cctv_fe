"use client";
import { Button } from "../ui/button";
import { Select, Switch } from "../ui/field";
import { Panel } from "../ui/layout";
import { ui } from "../ui/styles";

const settingRow = "flex flex-wrap items-center justify-between gap-3.5 border-b border-dashed border-[#d9d9d9] px-3 py-2.5 max-[600px]:px-0 [&>div]:min-w-[180px] [&>div]:flex-1 [&_p]:mt-[3px] [&_p]:text-xs/normal [&_p]:text-[#737373] [&_select]:min-w-[200px] [&_select]:flex-1";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  Save,
} from "lucide-react";
import { toast } from "../ui/toast";
const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/cctv`;
export default function GeneralSettingsPanel() {
  const [companyId, setCompanyId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const live = useRef(true);
  const api = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...(body !== undefined
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          typeof payload.detail === "string"
            ? payload.detail
            : "Pengaturan belum dapat dimuat.",
        );
      return payload.result ?? payload;
    },
    [],
  );
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const user = JSON.parse(localStorage.getItem("user_info") || "null");
      const cid =
        (user?.account_type === "personal" ? user?.id : user?.company_id) ||
        localStorage.getItem("cctv_company_id") ||
        "";
      setCompanyId(cid);
      if (!cid)
        throw new Error(
          "Workspace belum tersedia. Lengkapi pengaturan akun Anda.",
        );
      const company = await api<{ enabled?: boolean; timezone?: string }>(
        `/settings/${encodeURIComponent(cid)}`,
      );
      if (!live.current) return;
      setEnabled(company.enabled ?? true);
      setTimezone(company.timezone || "Asia/Jakarta");
      setReady(true);
    } catch (error) {
      if (live.current)
        setError(
          error instanceof Error ? error.message : "Pengaturan gagal dimuat.",
        );
    } finally {
      if (live.current) setBusy(false);
    }
  }, [api]);
  useEffect(() => {
    live.current = true;
    const initial = setTimeout(refresh, 0);
    return () => {
      live.current = false;
      clearTimeout(initial);
    };
  }, [refresh]);
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/settings/${encodeURIComponent(companyId)}`, {
        enabled,
        timezone,
      });
      const msg = "Pengaturan sistem disimpan.";
      setMessage(msg);
      toast.success(msg);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Perubahan belum tersimpan.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setBusy(false);
    }
  }
  
  return (
    <div aria-busy={busy}>
      {error && (
        <p role="alert" className={ui.error}>
          {error}{" "}
          <button className="underline" onClick={() => refresh()}>
            Coba lagi
          </button>
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-800"
        >
          {message}
        </p>
      )}
      <div>
        <Panel>
          <div className={ui.panelHeading}>
            <div>
              <h2>Sistem Komputer Visi</h2>
              <p className={ui.panelDescription}>
                Pengaturan mesin AI dan zona waktu aplikasi
              </p>
            </div>
            <Button onClick={() => refresh()} disabled={busy}>
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
          <fieldset disabled={busy || !ready}>
            <label className={settingRow}>
              <div>
                <span>Status Mesin AI</span>
                <p>Matikan untuk menonaktifkan semua kamera.</p>
              </div>
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            </label>
            <label className={settingRow}>
              <div>
                <span>Zona waktu global</span>
                <p>
                  Dipakai untuk jadwal event, laporan, statistik, dan tampilan
                  waktu.
                </p>
              </div>
              <Select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {[
                  ["Asia/Jakarta", "Asia/Jakarta (WIB)"],
                  ["Asia/Makassar", "Asia/Makassar (WITA)"],
                  ["Asia/Jayapura", "Asia/Jayapura (WIT)"],
                  ["Asia/Singapore", "Asia/Singapore"],
                  ["Asia/Tokyo", "Asia/Tokyo"],
                  ["UTC", "UTC"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <Button className="mt-4 w-full" onClick={() => save()}>
              <Save size={16} />
              Simpan
            </Button>
          </fieldset>
        </Panel>
      </div>

    </div>
  );
}
