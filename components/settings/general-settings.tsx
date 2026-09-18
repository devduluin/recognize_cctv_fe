"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CircleAlert,
  CheckCircle2,
  Cpu,
  Database,
  FileSearch,
  Gauge,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Save,
  ShieldCheck,
  Square,
  User,
  XCircle,
} from "lucide-react";

const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/cctv`;

type UserInfo = {
  id?: string;
  company_id?: string;
  full_name?: string;
  email?: string;
  account_type?: string;
};

type RuntimeSettings = {
  monitor_mode: "" | "visitor" | "attendance" | "both";
  detection_min_confidence: number;
  similarity_threshold: number;
  reid_similarity_threshold: number;
  track_iou_threshold: number;
  track_confirm_hits: number;
  track_max_missed_frames: number;
  detect_width: number;
  min_face_width: number;
  min_face_height: number;
  min_face_brightness: number;
  min_face_blur: number;
  adaptive_frame_skip_enabled: boolean;
  target_inference_ms: number;
  max_frame_skip: number;
  face_model_path?: string;
  vector_db_path?: string;
  vector_db_collection?: string;
  attendance_photos_url?: string;
  gender_model_path?: string;
  person_model_path?: string;
  rabbitmq_url_configured?: boolean;
};

type WorkerStatus = {
  running?: boolean;
  status?: string;
  fps?: number;
  latency_ms?: number;
};

type RuntimeStatus = {
  running?: boolean;
  prepared?: boolean;
  error?: string | null;
  company_id?: string | null;
  runtime?: { prepared?: boolean; error?: string | null };
  cameras?: Record<string, WorkerStatus>;
};

type HealthCheck = {
  ok: boolean;
  required: boolean;
  message: string;
};

type HealthPayload = {
  ok: boolean;
  checks: Record<string, HealthCheck>;
};

type ApiOptions = RequestInit & {
  headers?: Record<string, string>;
};

const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  monitor_mode: "",
  detection_min_confidence: 0.5,
  similarity_threshold: 0.8,
  reid_similarity_threshold: 0.82,
  track_iou_threshold: 0.35,
  track_confirm_hits: 5,
  track_max_missed_frames: 12,
  detect_width: 480,
  min_face_width: 32,
  min_face_height: 32,
  min_face_brightness: 28,
  min_face_blur: 18,
  adaptive_frame_skip_enabled: false,
  target_inference_ms: 120,
  max_frame_skip: 3,
};

const TIMEZONE_OPTIONS = [
  ["Asia/Jakarta", "Asia/Jakarta (WIB)"],
  ["Asia/Makassar", "Asia/Makassar (WITA)"],
  ["Asia/Jayapura", "Asia/Jayapura (WIT)"],
  ["Asia/Singapore", "Asia/Singapore"],
  ["Asia/Tokyo", "Asia/Tokyo"],
  ["UTC", "UTC"],
] as const;

function readUserInfo(): UserInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const userInfoStr = localStorage.getItem("user_info");
    return userInfoStr ? JSON.parse(userInfoStr) : null;
  } catch {
    return null;
  }
}

function resolveCompanyId(user: UserInfo | null) {
  if (!user) return "";
  return user.account_type === "personal" ? user.id || "" : user.company_id || "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan";
}

export default function GeneralSettingsPanel() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsEnabled, setSettingsEnabled] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings>(DEFAULT_RUNTIME_SETTINGS);
  const [health, setHealth] = useState<HealthPayload | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const api = useCallback(async <T,>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const payload = await res.json();
    if (!res.ok) {
      const message = payload.detail || payload.message || "Request failed";
      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }
    return payload?.result ?? payload;
  }, []);

  const loadCompanySettings = useCallback(
    async (cid: string) => {
      if (!cid) return;
      const settings = await api<{ enabled?: boolean; timezone?: string }>(`/settings/${encodeURIComponent(cid)}`);
      setSettingsEnabled(Boolean(settings.enabled ?? true));
      setTimezone(settings.timezone || "Asia/Jakarta");
    },
    [api]
  );

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!silent) setBusy(true);
      try {
        const user = readUserInfo();
        const cid = resolveCompanyId(user);
        setUserInfo(user);
        setCompanyId(cid);
        await Promise.all([
          cid ? loadCompanySettings(cid) : Promise.resolve(),
          api<RuntimeStatus>(`/status?company_id=${encodeURIComponent(cid)}`).then(setStatus),
          api<RuntimeSettings>(`/runtime/settings${cid ? `?company_id=${encodeURIComponent(cid)}` : ""}`).then((data) =>
            setRuntimeSettings({ ...DEFAULT_RUNTIME_SETTINGS, ...data })
          ),
          api<HealthPayload>("/health").then(setHealth),
        ]);
      } catch (error) {
        showToast(errorMessage(error));
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [api, loadCompanySettings, showToast]
  );

  useEffect(() => {
    const loadInitialState = async () => {
      await refreshAll(true);
    };
    loadInitialState();
    const interval = setInterval(() => {
      const cid = resolveCompanyId(readUserInfo());
      if (cid) api<RuntimeStatus>(`/status?company_id=${encodeURIComponent(cid)}`).then(setStatus).catch(() => {});
    }, 3000);
    return () => {
      clearInterval(interval);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [api, refreshAll]);

  const saveCompanySettings = async () => {
    if (!companyId) {
      showToast("Workspace ID tidak ditemukan");
      return;
    }
    setBusy(true);
    try {
      await api(`/settings/${encodeURIComponent(companyId)}`, {
        method: "POST",
        body: JSON.stringify({ enabled: settingsEnabled, timezone }),
      });
      const savedRuntime = await api<RuntimeSettings>(
        `/runtime/settings${companyId ? `?company_id=${encodeURIComponent(companyId)}` : ""}`,
        {
        method: "POST",
        body: JSON.stringify({ monitor_mode: runtimeSettings.monitor_mode }),
        }
      );
      setRuntimeSettings((prev) => ({ ...prev, ...savedRuntime }));
      localStorage.setItem("monitor_mode", savedRuntime.monitor_mode);
      window.dispatchEvent(new CustomEvent("monitor-mode-changed", { detail: savedRuntime.monitor_mode }));
      await refreshAll(true);
      showToast("Pengaturan umum disimpan");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveRuntimeSettings = async () => {
    setBusy(true);
    try {
      const saved = await api<RuntimeSettings>(
        `/runtime/settings${companyId ? `?company_id=${encodeURIComponent(companyId)}` : ""}`,
        {
        method: "POST",
        body: JSON.stringify({
          detection_min_confidence: runtimeSettings.detection_min_confidence,
          similarity_threshold: runtimeSettings.similarity_threshold,
          max_frame_skip: runtimeSettings.max_frame_skip,
        }),
        }
      );
      setRuntimeSettings({ ...DEFAULT_RUNTIME_SETTINGS, ...saved });
      localStorage.setItem("monitor_mode", saved.monitor_mode);
      window.dispatchEvent(new CustomEvent("monitor-mode-changed", { detail: saved.monitor_mode }));
      await refreshAll(true);
      showToast("Tuning AI disimpan");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (endpoint: string, message: string) => {
    setBusy(true);
    try {
      const scopedEndpoint = companyId && (endpoint === "/start" || endpoint === "/stop")
        ? `${endpoint}?company_id=${encodeURIComponent(companyId)}`
        : endpoint;
      await api(scopedEndpoint, { method: "POST" });
      await refreshAll(true);
      showToast(message);
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const restartRuntime = async () => {
    setBusy(true);
    try {
      const stopEndpoint = companyId ? `/stop?company_id=${encodeURIComponent(companyId)}` : "/stop";
      await api(stopEndpoint, { method: "POST" });
      await api("/prepare", { method: "POST" });
      await refreshAll(true);
      showToast("Mesin AI dimuat ulang");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const updateRuntimeNumber = (key: keyof RuntimeSettings, value: string) => {
    const parsed = Number(value);
    setRuntimeSettings((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  const activeWorkers = useMemo(
    () => Object.values(status?.cameras || {}).filter((camera) => camera.running),
    [status?.cameras]
  );

  const performance = useMemo(() => {
    if (!activeWorkers.length) return { fps: 0, latency: 0 };
    const fps = activeWorkers.reduce((sum, item) => sum + Number(item.fps || 0), 0) / activeWorkers.length;
    const latency =
      activeWorkers.reduce((sum, item) => sum + Number(item.latency_ms || 0), 0) / activeWorkers.length;
    return { fps, latency };
  }, [activeWorkers]);

  const runtimePrepared = Boolean(status?.prepared ?? status?.runtime?.prepared);
  const runtimeError = status?.error || status?.runtime?.error;

  return (
    <div className="font-sans text-slate-900 selection:bg-indigo-500/30">
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-6 left-1/2 z-50 px-6 py-3 bg-slate-900 text-white text-sm font-medium rounded-full shadow-2xl shadow-slate-900/20"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold">Profil Pengguna</h2>
              <p className="text-xs text-slate-500 mt-0.5">Informasi akun yang sedang aktif</p>
            </div>
          </div>

          {userInfo ? (
            <div className="space-y-4">
              <InfoRow label="Nama" value={userInfo.full_name || "-"} />
              <InfoRow label="Email" value={userInfo.email || "-"} />
              {process.env.NEXT_PUBLIC_APP_MODE !== "single_tenant" && (
                <>
                  <InfoRow label="Tipe Akun" value={userInfo.account_type || "Belum diatur"} />
                  <InfoRow label="Workspace ID" value={companyId || "-"} mono />
                </>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Memuat profil...</div>
          )}
        </section>

        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Power size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold">Sistem Komputer Visi</h2>
                <p className="text-xs text-slate-500 mt-0.5">Kontrol mesin AI pusat dan status runtime kamera</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshAll()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <MetricCard label="Runtime" value={runtimePrepared ? "Siap" : "Belum Siap"} icon={<Cpu size={18} />} />
            <MetricCard label="Kamera Aktif" value={`${activeWorkers.length}`} icon={<Activity size={18} />} />
            <MetricCard label="FPS Rata-rata" value={performance.fps.toFixed(1)} icon={<Gauge size={18} />} />
            <MetricCard label="Latency" value={`${performance.latency.toFixed(0)} ms`} icon={<ShieldCheck size={18} />} />
          </div>

          <div className="mt-6 space-y-4">
            <label className="flex items-center justify-between gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50">
              <div>
                <span className="block text-sm font-medium text-slate-900">Status Mesin AI</span>
                <span className="block text-xs text-slate-500">Matikan untuk menonaktifkan semua kamera.</span>
              </div>
              <div
                className="relative inline-block h-6 w-12 rounded-full cursor-pointer transition-colors shrink-0"
                style={{ backgroundColor: settingsEnabled ? "#059669" : "#cbd5e1" }}
              >
                <input
                  type="checkbox"
                  className="h-0 w-0 opacity-0"
                  checked={settingsEnabled}
                  onChange={(event) => setSettingsEnabled(event.target.checked)}
                  disabled={busy}
                />
                <span
                  className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    settingsEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </div>
            </label>

            <div className="rounded-xl border border-slate-200 p-4">
              <label htmlFor="global-timezone" className="block text-sm font-medium text-slate-900">Zona waktu global</label>
              <p className="mt-1 text-xs text-slate-500">Dipakai untuk jadwal event, laporan, statistik, dan tampilan waktu.</p>
              <select
                id="global-timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={busy}
                className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {TIMEZONE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3">
                <span className="block text-sm font-medium text-slate-900">Jenis Monitoring</span>
                <span className="block text-xs text-slate-500">Pilih proses AI yang dijalankan oleh tombol Start.</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  ["visitor", "Monitor Pengunjung"],
                  ["attendance", "Monitor Absensi"],
                ] as const).map(([value, label]) => {
                  const visitorChecked = runtimeSettings.monitor_mode === "visitor" || runtimeSettings.monitor_mode === "both";
                  const attendanceChecked = runtimeSettings.monitor_mode === "attendance" || runtimeSettings.monitor_mode === "both";
                  const checked = value === "visitor" ? visitorChecked : attendanceChecked;

                  return (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      name="monitor-mode"
                      value={value}
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const nextVisitor = value === "visitor" ? event.target.checked : visitorChecked;
                        const nextAttendance = value === "attendance" ? event.target.checked : attendanceChecked;
                        setRuntimeSettings((prev) => ({
                          ...prev,
                          monitor_mode: nextVisitor && nextAttendance ? "both" : nextVisitor ? "visitor" : nextAttendance ? "attendance" : "",
                        }));
                      }}
                      disabled={busy}
                      className="h-4 w-4 border-slate-300 text-emerald-600"
                    />
                    {label}
                  </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <ActionButton icon={<Save size={16} />} label="Simpan" onClick={saveCompanySettings} disabled={busy} />
              <ActionButton icon={<Play size={16} />} label="Prepare" onClick={() => runAction("/prepare", "Mesin AI disiapkan")} disabled={busy} />
              <ActionButton icon={<Play size={16} />} label="Start" onClick={() => runAction("/start", "Monitoring perusahaan dijalankan")} disabled={busy} />
              <ActionButton icon={<Square size={16} />} label="Stop" onClick={() => runAction("/stop", "Monitoring perusahaan dihentikan")} disabled={busy} />
              <ActionButton icon={<RotateCw size={16} />} label="Restart" onClick={restartRuntime} disabled={busy} />
            </div>

            {runtimeError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {runtimeError}
              </div>
            )}
          </div>
        </section>

        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Default AI Tuning</h2>
                <span className="group relative inline-flex" tabIndex={0}>
                  <CircleAlert size={16} className="text-slate-400 transition-colors group-hover:text-indigo-600 group-focus:text-indigo-600" aria-label="Informasi Default AI Tuning" />
                  <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                    Nilai ini menjadi konfigurasi bawaan untuk kamera yang belum memiliki pengaturan khusus.
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Nilai bawaan untuk kamera yang tidak punya override khusus</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <NumberField label="Detection Confidence" help="Batas minimal keyakinan model saat mendeteksi wajah. Nilai lebih tinggi mengurangi false positive, tetapi bisa melewatkan wajah yang kurang jelas." value={runtimeSettings.detection_min_confidence} step="0.01" min="0" max="1" onChange={(value) => updateRuntimeNumber("detection_min_confidence", value)} />
            <NumberField label="Similarity Threshold" help="Kemiripan minimal wajah dengan data terdaftar agar dianggap orang yang sama. Nilai lebih tinggi lebih ketat." value={runtimeSettings.similarity_threshold} step="0.01" min="0" max="1" onChange={(value) => updateRuntimeNumber("similarity_threshold", value)} />
            <NumberField label="Max Frame Skip" help="Batas maksimum frame yang dilewati saat CPU tidak mampu mengejar. Nilai lebih tinggi mengurangi beban, tetapi gerakan lebih mudah terlewat." value={runtimeSettings.max_frame_skip} step="1" min="1" max="10" onChange={(value) => updateRuntimeNumber("max_frame_skip", value)} />
          </div>

          <button
            type="button"
            onClick={saveRuntimeSettings}
            disabled={busy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save size={16} />
            Simpan Tuning AI
          </button>
        </section>

        <section className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                <FileSearch size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold">Konfigurasi Model</h2>
                <p className="text-xs text-slate-500 mt-0.5">Path model dan integrasi aktif</p>
              </div>
            </div>
            <div className="space-y-3">
              <InfoRow label="Face YOLO" value={runtimeSettings.face_model_path || "-"} mono />
              <InfoRow label="Gender Model" value={runtimeSettings.gender_model_path || "-"} mono />
              <InfoRow label="Person YOLO" value={runtimeSettings.person_model_path || "-"} mono />
              <InfoRow label="Vector DB" value={runtimeSettings.vector_db_path || "-"} mono />
              <InfoRow label="Collection" value={runtimeSettings.vector_db_collection || "-"} mono />
              <InfoRow label="HRMS Photos" value={runtimeSettings.attendance_photos_url || "-"} mono />
              <InfoRow label="RabbitMQ" value={runtimeSettings.rabbitmq_url_configured ? "Configured" : "Not configured"} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <Database size={20} />
              </div>
              <div>
                <h2 className="text-base font-semibold">Health Check</h2>
                <p className="text-xs text-slate-500 mt-0.5">Validasi dependency utama runtime</p>
              </div>
            </div>
            <div className="mb-4 flex items-center gap-2 text-sm font-medium">
              {health?.ok ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-red-500" />}
              <span>{health?.ok ? "Semua dependency wajib siap" : "Ada dependency wajib bermasalah"}</span>
            </div>
            <div className="space-y-2">
              {Object.entries(health?.checks || {}).map(([key, check]) => (
                <div key={key} className="rounded-xl border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium capitalize text-slate-800">{key.replaceAll("_", " ")}</span>
                    {check.ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-red-500" />}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{check.message}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`col-span-2 truncate text-sm font-medium text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-2 text-slate-500">{icon}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function NumberField({
  label,
  help,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="block rounded-xl border border-slate-200 px-4 py-3">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
        {label}
        <span className="group relative inline-flex" tabIndex={0}>
          <CircleAlert size={15} className="text-slate-400 transition-colors group-hover:text-indigo-600 group-focus:text-indigo-600" aria-label={`Informasi ${label}`} />
          <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus:opacity-100">
            {help}
          </span>
        </span>
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
      />
    </label>
  );
}
