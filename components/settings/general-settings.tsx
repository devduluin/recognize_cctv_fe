"use client";
import { Button } from "../ui/button";
import { Field, Input, Select, Switch } from "../ui/field";
import { InfoRow, Panel } from "../ui/layout";
import { cx, ui } from "../ui/styles";

const settingRow = "flex flex-wrap items-center justify-between gap-3.5 border-b border-dashed border-[#d9d9d9] px-3 py-2.5 max-[600px]:px-0 [&>div]:min-w-[180px] [&>div]:flex-1 [&_p]:mt-[3px] [&_p]:text-xs/normal [&_p]:text-[#737373] [&_select]:min-w-[200px] [&_select]:flex-1";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  Play,
  Square,
  RotateCw,
} from "lucide-react";
const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/cctv`;
type RuntimeSettings = {
  monitor_mode: string;
  detection_min_confidence: number;
  similarity_threshold: number;
  max_frame_skip: number;
  face_model_path?: string;
  gender_model_path?: string;
  person_model_path?: string;
  vector_db_path?: string;
  vector_db_collection?: string;
  attendance_photos_url?: string;
  rabbitmq_url_configured?: boolean;
};
type RuntimeStatus = {
  prepared?: boolean;
  error?: string;
  runtime?: { prepared?: boolean; error?: string };
  cameras?: Record<
    string,
    { running?: boolean; fps?: number; latency_ms?: number }
  >;
};
type Health = {
  ok: boolean;
  checks: Record<string, { ok: boolean; message: string }>;
};
const defaults: RuntimeSettings = {
  monitor_mode: "visitor",
  detection_min_confidence: 0.5,
  similarity_threshold: 0.8,
  max_frame_skip: 3,
};
export default function GeneralSettingsPanel() {
  const [companyId, setCompanyId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [settings, setSettings] = useState(defaults);
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
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
      const query = `?company_id=${encodeURIComponent(cid)}`;
      const [company, runtime, currentStatus, currentHealth] =
        await Promise.all([
          api<{ enabled?: boolean; timezone?: string }>(
            `/settings/${encodeURIComponent(cid)}`,
          ),
          api<RuntimeSettings>(`/runtime/settings${query}`),
          api<RuntimeStatus>(`/status${query}`),
          api<Health>("/health"),
        ]);
      if (!live.current) return;
      setEnabled(company.enabled ?? true);
      setTimezone(company.timezone || "Asia/Jakarta");
      setSettings({ ...defaults, ...runtime });
      setStatus(currentStatus);
      setHealth(currentHealth);
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
  useEffect(() => {
    if (!companyId) return;
    const timer = setInterval(() => {
      api<RuntimeStatus>(`/status?company_id=${encodeURIComponent(companyId)}`)
        .then((value) => {
          if (live.current) setStatus(value);
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [api, companyId]);
  async function save(tuning = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!tuning)
        await api(`/settings/${encodeURIComponent(companyId)}`, {
          enabled,
          timezone,
        });
      const saved = await api<RuntimeSettings>(
        `/runtime/settings?company_id=${encodeURIComponent(companyId)}`,
        tuning
          ? {
              detection_min_confidence: settings.detection_min_confidence,
              similarity_threshold: settings.similarity_threshold,
              max_frame_skip: settings.max_frame_skip,
            }
          : { monitor_mode: settings.monitor_mode },
      );
      setSettings((prev) => ({ ...prev, ...saved }));
      localStorage.setItem("monitor_mode", saved.monitor_mode);
      window.dispatchEvent(
        new CustomEvent("monitor-mode-changed", { detail: saved.monitor_mode }),
      );
      setMessage(
        tuning ? "Tuning AI disimpan." : "Pengaturan sistem disimpan.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Perubahan belum tersimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function runAction(action: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const query = `?company_id=${encodeURIComponent(companyId)}`;
      if (action === "restart") {
        await api(`/stop${query}`, {});
        await api("/prepare", {});
      } else
        await api(
          `/${action}${action === "start" || action === "stop" ? query : ""}`,
          {},
        );
      await refresh();
      setMessage("Perintah mesin AI selesai.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Perintah gagal.");
    } finally {
      setBusy(false);
    }
  }
  const workers = Object.values(status?.cameras || {}).filter(
    (camera) => camera.running,
  );
  const fps = workers.length
    ? workers.reduce((sum, camera) => sum + (camera.fps || 0), 0) /
      workers.length
    : 0;
  const latency = workers.length
    ? workers.reduce((sum, camera) => sum + (camera.latency_ms || 0), 0) /
      workers.length
    : 0;
  const modelRows = [
    ["Face YOLO", settings.face_model_path],
    ["Gender Model", settings.gender_model_path],
    ["Person YOLO", settings.person_model_path],
    ["Vector DB", settings.vector_db_path],
    ["Collection", settings.vector_db_collection],
    ["HRMS Photos", settings.attendance_photos_url],
    [
      "RabbitMQ",
      ready
        ? settings.rabbitmq_url_configured
          ? "Configured"
          : "Not configured"
        : "-",
    ],
  ];
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
      <div className="grid gap-5 min-[900px]:grid-cols-[minmax(0,2.05fr)_minmax(0,1fr)]">
        <Panel>
          <div className={ui.panelHeading}>
            <div>
              <h2>Sistem Komputer Visi</h2>
              <p className={ui.panelDescription}>
                Kontrol mesin AI pusat dan status runtime kamera
              </p>
            </div>
            <Button onClick={() => refresh()} disabled={busy}>
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
          <div className="my-6 grid grid-cols-2 gap-2 rounded-xl bg-[#f0f2f8] py-2 min-[600px]:grid-cols-4 [&>div]:border-r [&>div]:border-[#8b9dbb] [&>div]:px-4 [&>div]:py-[5px] [&>div:last-child]:border-0 [&_small]:mb-[3px] [&_small]:block [&_small]:text-xs/normal [&_small]:text-muted">
            {[
              [
                "Runtime",
                status
                  ? (status.prepared ?? status.runtime?.prepared)
                    ? "Siap"
                    : "Belum Siap"
                  : "-",
              ],
              ["Kamera Aktif", status ? workers.length : "-"],
              ["FPS Rata-rata", status ? fps.toFixed(1) : "-"],
              ["Latency", status ? `${latency.toFixed(0)} ms` : "-"],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
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
            <label className={settingRow}>
              <div>
                <span>Jenis Monitoring</span>
                <p>Pilih proses AI yang dijalankan oleh tombol Start.</p>
              </div>
              <Select
                value={settings.monitor_mode}
                onChange={(e) =>
                  setSettings({ ...settings, monitor_mode: e.target.value })
                }
              >
                <option value="">Pilih monitoring</option>
                <option value="visitor">Monitor Pengunjung</option>
                <option value="attendance">Absensi CCTV</option>
                <option value="both">Pengunjung & Absensi</option>
              </Select>
            </label>
            <Button className="mt-4 w-full" onClick={() => save()}>
              <Save size={16} />
              Simpan
            </Button>
          </fieldset>
          {(status?.error || status?.runtime?.error) && (
            <p role="alert" className={cx(ui.error, "mt-4")}>
              {status.error || status.runtime?.error}
            </p>
          )}
        </Panel>
        <Panel>
          <h2>Default AI Tuning</h2>
          <p className={ui.panelDescription}>
            Nilai bawaan untuk kamera yang tidak punya override khusus
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(true);
            }}
          >
            <fieldset disabled={busy || !ready}>
              <div className="my-6 grid gap-3.5">
                {(
                  [
                    [
                      "detection_min_confidence",
                      "Detection Confidence",
                      0,
                      1,
                      0.01,
                    ],
                    [
                      "similarity_threshold",
                      "Similarity Threshold",
                      0,
                      1,
                      0.01,
                    ],
                    ["max_frame_skip", "Max Frame Skip", 1, 10, 1],
                  ] as const
                ).map(([key, label, min, max, step]) => (
                  <Field key={key}>
                    {label}
                    <Input
                      type="number"
                      required
                      min={min}
                      max={max}
                      step={step}
                      value={settings[key]}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          [key]: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Button variant="primary" className="w-full" type="submit">
                Simpan Perubahan
              </Button>
            </fieldset>
          </form>
        </Panel>
      </div>
      <div className="mt-5 grid items-start gap-5 min-[900px]:grid-cols-2">
        <Panel>
          <h2>Konfigurasi Model</h2>
          <p className={cx(ui.panelDescription, "mb-4")}>
            Path model dan integrasi aktif
          </p>
          {modelRows.map(([label, value]) => (
            <InfoRow key={label}>
              <span>{label}</span>
              <span>{value || "-"}</span>
            </InfoRow>
          ))}
        </Panel>
        <Panel>
          <h2>Health Check</h2>
          <p className={cx(ui.panelDescription, "mb-5")}>
            Validasi dependency utama runtime
          </p>
          {health ? (
            <>
              {Object.entries(health.checks).map(([key, check]) => (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 max-[600px]:flex-wrap [&_svg]:shrink-0" key={key}>
                  {check.ok ? (
                    <CheckCircle2 size={15} className="text-emerald-600" />
                  ) : (
                    <XCircle size={15} className="text-red-600" />
                  )}
                  <span className="capitalize">{key.replaceAll("_", " ")}</span>
                  <small className="ml-auto max-w-[52%] text-right text-muted [overflow-wrap:anywhere] max-[600px]:max-w-full">{check.message}</small>
                </div>
              ))}
              <p className="mt-5 text-center text-xs text-[#0c2e73]">
                {health.ok
                  ? "Semua dependency wajib siap"
                  : "Ada dependency wajib bermasalah"}
              </p>
            </>
          ) : (
            <p className={ui.emptyState}>
              {error ? "Status belum tersedia." : "Memuat status…"}
            </p>
          )}
        </Panel>
      </div>
      <details className="mt-6">
        <summary className="py-3 text-sm text-[#607596]">
          Kontrol runtime lanjutan
        </summary>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "prepare", label: "Prepare", icon: Play },
            { key: "start", label: "Start", icon: Play },
            { key: "stop", label: "Stop", icon: Square },
            { key: "restart", label: "Restart", icon: RotateCw },
          ].map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              disabled={busy || !ready}
              onClick={() => runAction(key)}
            >
              <Icon size={16} />
              {label}
            </Button>
          ))}
        </div>
      </details>
    </div>
  );
}
