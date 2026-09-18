"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Camera,
  Cpu,
  LayoutDashboard,
  Users,
  CheckCircle2,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Video,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const API_BASE =
  (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") +
  "/api/v1/event_visitor";
const panel =
  "bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm";
const input =
  "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50";
const primary =
  "shadow-sm flex items-center justify-center gap-2 w-full py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed";
const secondary =
  "inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-sm text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

type VisitorStatus = {
  camera_source: string | number | null;
  line_position: number;
  line_orientation: string;
  reverse_direction: boolean;
  running: boolean;
  model_change_pending?: boolean;
  session_id: string | null;
  unique_visitor_count: number;
  last_visitor_at: string | null;
  last_error?: string;
};
type Notice = { message: string; error: boolean };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let companyId = "";
  try {
    const user = JSON.parse(localStorage.getItem("user_info") || "null");
    companyId = user?.account_type === "personal" ? user?.id || "" : user?.company_id || "";
    companyId ||= localStorage.getItem("cctv_company_id") || "";
  } catch {}
  const separator = path.includes("?") ? "&" : "?";
  const scopedPath = companyId ? `${path}${separator}company_id=${encodeURIComponent(companyId)}` : path;
  const response = await fetch(`${API_BASE}${scopedPath}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  const payload = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      `Permintaan gagal (${response.status}). Coba lagi.`;
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }
  return payload?.result ?? payload;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Tidak dapat menghubungi kamera. Coba lagi.";
}

export default function VisitorSettingsPanel() {
  const [status, setStatus] = useState<VisitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cameraSource, setCameraSource] = useState("");

  const [linePosition, setLinePosition] = useState(50);
  const [lineOrientation, setLineOrientation] = useState("horizontal");
  const [reverseDirection, setReverseDirection] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const initialized = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const applySettings = useCallback((data: VisitorStatus) => {
    setCameraSource(String(data.camera_source ?? ""));

    setLinePosition(Math.round((data.line_position ?? 0.5) * 100));
    setLineOrientation(data.line_orientation ?? "horizontal");
    setReverseDirection(data.reverse_direction ?? false);
  }, []);

  const refreshStatus = useCallback(
    async (reloadSettings = false) => {
      const id = ++requestId.current;
      try {
        const data = await api<VisitorStatus>("/status");
        if (!mounted.current || id !== requestId.current) return;
        setStatus(data);
        setConnectionError("");
        if (!initialized.current || reloadSettings) {
          applySettings(data);
          initialized.current = true;
        }
      } catch (error) {
        if (mounted.current && id === requestId.current)
          setConnectionError(errorMessage(error));
      } finally {
        if (mounted.current && id === requestId.current) setLoading(false);
      }
    },
    [applySettings],
  );

  useEffect(() => {
    mounted.current = true;
    const initialLoad = setTimeout(() => void refreshStatus(), 0);
    const interval = setInterval(() => void refreshStatus(), 3000);
    return () => {
      mounted.current = false;
      requestId.current += 1;
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Each endpoint confirms its own database write; a failed batch can be retried.
  const saveChanges = async (
    changes: [string, Record<string, string | number | boolean>][],
    message: string,
  ) => {
    setBusy(true);
    setNotice(null);
    ++requestId.current;
    let saved = 0;
    try {
      for (const [path, values] of changes) {
        await api(path, { method: "POST", body: JSON.stringify(values) });
        saved += 1;
      }
      setNotice({ message, error: false });
      return true;
    } catch (error) {
      setNotice({
        message: `${saved ? "Sebagian perubahan sudah tersimpan. Simpan ulang untuk menyelesaikan. " : ""}${errorMessage(error)}`,
        error: true,
      });
      return false;
    } finally {
      await refreshStatus();
      setBusy(false);
    }
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveChanges(
      [
        ["/orientation", { orientation: lineOrientation }],
        ["/line", { position: linePosition / 100 }],
        ["/reverse", { reverse: reverseDirection }],
      ],
      "Pengaturan counter berhasil disimpan.",
    );
  };

  const saveCamera = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cameraSource.trim()) return;
    const saved = await saveChanges(
      [["/source", { camera_source: cameraSource.trim() }]],
      "Pengaturan kamera berhasil disimpan.",
    );
    if (saved) setShowEditor(false);
  };

  const configured =
    status?.camera_source != null && String(status.camera_source).trim() !== "";
  const disabled = loading || busy || !status || Boolean(connectionError);
  const settingsDirty =
    status &&
    (linePosition !== Math.round(status.line_position * 100) ||
      lineOrientation !== status.line_orientation ||
      reverseDirection !== status.reverse_direction);
  const running = Boolean(status?.running);
  const stateLabel = connectionError
    ? "Offline"
    : loading
      ? "Checking"
      : running
        ? "Running"
        : status?.last_error
          ? "Error"
          : "Stopped";
  const direction =
    lineOrientation === "horizontal"
      ? reverseDirection
        ? "Bawah → atas"
        : "Atas → bawah"
      : reverseDirection
        ? "Kanan → kiri"
        : "Kiri → kanan";

  return (
    <div className="text-slate-900 font-sans selection:bg-indigo-500/30">
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-7 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold tracking-tight">Konfigurasi Event Visitor</h2>
          <p className="mt-2 text-sm text-slate-500">Kelola kamera dan aturan penghitungan dalam satu tempat.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Link 
            href="/events"
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg transition-colors text-slate-700 hover:text-slate-900"
          >
            <Video size={16} />
            <span>Buka Dashboard Visitor</span>
          </Link>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            <span className={`w-2 h-2 rounded-full ${running ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : connectionError ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"}`} />
            <span className="text-slate-700 font-medium">{stateLabel}</span>
          </div>
        </div>
      </motion.header>

      <div>
        
        {connectionError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/20 bg-red-50 p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-red-700"
          >
            <span>{connectionError}</span>
            <button
              type="button"
              className={secondary}
              onClick={() => void refreshStatus()}
            >
              <RefreshCw size={16} />
              Coba lagi
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-6">
            <section id="settings" className={`${panel} scroll-mt-24`}>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Pengaturan Counter</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Pilih garis dan arah pengunjung masuk.
                  </p>
                </div>
                <button
                  type="button"
                  className={secondary}
                  aria-label="Muat ulang pengaturan tersimpan"
                  title="Muat ulang pengaturan tersimpan"
                  disabled={busy || loading}
                  onClick={() => void refreshStatus(true)}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <form onSubmit={saveSettings} className="p-6 space-y-6">
                <div
                  className={`p-4 rounded-xl border flex gap-3 text-sm ${configured ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-amber-500/10 border-amber-500/20 text-amber-700"}`}
                >
                  {loading ? (
                    <Loader2 size={20} className="shrink-0 animate-spin" />
                  ) : (
                    <Info size={20} className="shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className="block font-medium">
                      {loading
                        ? "Memuat pengaturan"
                        : configured
                          ? "Kamera sudah dikonfigurasi"
                          : "Belum setup kamera"}
                    </strong>
                    <p className="text-xs leading-relaxed opacity-80 mt-1">
                      {configured
                        ? "Simpan perubahan garis, lalu periksa hasilnya pada live preview."
                        : "Tambahkan sumber kamera untuk mulai menghitung pengunjung."}
                    </p>
                  </div>
                </div>
                <fieldset
                  disabled={disabled}
                  className="space-y-5 disabled:opacity-50"
                >
                  <label className="block text-sm text-slate-500">
                    <span className="block mb-2 font-medium">
                      Orientasi Garis
                    </span>
                    <select
                      className={input}
                      value={lineOrientation}
                      onChange={(e) => setLineOrientation(e.target.value)}
                    >
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                    </select>
                  </label>
                  <label className="block text-sm text-slate-500">
                    <span className="flex items-center justify-between mb-3 font-medium">
                      Posisi Garis
                      <span className="px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-700 tabular-nums">
                        {linePosition}%
                      </span>
                    </span>
                    <input
                      className="w-full accent-indigo-500"
                      type="range"
                      min="10"
                      max="90"
                      step="1"
                      value={linePosition}
                      onChange={(e) => setLinePosition(Number(e.target.value))}
                    />
                    <span className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>
                        {lineOrientation === "horizontal" ? "Atas" : "Kiri"}
                      </span>
                      <span>
                        {lineOrientation === "horizontal" ? "Bawah" : "Kanan"}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start justify-between gap-4 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer">
                    <span>
                      <strong className="block text-sm font-medium">
                        Balik Arah Hitung
                      </strong>
                      <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
                        Arah masuk: {direction}. Arah sebaliknya dihitung
                        keluar.
                      </span>
                    </span>
                    <span className="relative shrink-0 mt-1">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={reverseDirection}
                        onChange={(e) => setReverseDirection(e.target.checked)}
                      />
                      <span className="block w-11 h-6 rounded-full bg-slate-300 border border-slate-200 peer-checked:bg-indigo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
                    </span>
                  </label>
                </fieldset>
                {settingsDirty && (
                  <p className="text-xs text-amber-700">
                    Ada perubahan pengaturan yang belum disimpan.
                  </p>
                )}
                <button
                  className={primary}
                  type="submit"
                  disabled={disabled || !settingsDirty}
                >
                  {busy ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Simpan Pengaturan
                </button>
              </form>
            </section>

            <section id="session" className={`${panel} p-6 scroll-mt-24`}>
              <h2 className="text-lg font-medium mb-5">Informasi Sesi</h2>
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Session ID</dt>
                  <dd className="text-xs text-right font-mono break-all max-w-[65%]">
                    {status?.session_id || "Belum ada sesi"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Pengunjung unik</dt>
                  <dd>{status?.unique_visitor_count ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Visitor terakhir</dt>
                  <dd className="text-right">
                    {status?.last_visitor_at
                      ? new Date(status.last_visitor_at).toLocaleString("id-ID")
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Error</dt>
                  <dd className="text-red-600 text-right break-words max-w-[70%]">
                    {status?.last_error || connectionError || "—"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="xl:col-span-8 min-w-0 space-y-6">
            <section id="camera" className={`${panel} scroll-mt-24`}>
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-medium">Kamera CCTV</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Satu kamera untuk menghitung pengunjung masuk dan keluar.
                </p>
              </div>
              <div className="p-6 space-y-5">
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center">
                        <Video size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">
                          Kamera Event Visitor
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {configured
                            ? "Sumber kamera tersimpan"
                            : "Belum ada kamera"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-slate-500">
                      {stateLabel}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 break-all">
                    {configured
                      ? String(status?.camera_source)
                      : "Tambahkan webcam, RTSP URL, atau video untuk memulai."}
                  </div>
                  <button
                    type="button"
                    className={`${secondary} w-full`}
                    disabled={disabled || running}
                    onClick={() => {
                      setCameraSource(String(status?.camera_source ?? ""));
                      setShowEditor(true);
                    }}
                  >
                    {configured ? <Pencil size={16} /> : <Plus size={16} />}
                    {configured ? "Edit Kamera" : "Setup Kamera"}
                  </button>
                  {running && (
                    <p className="text-xs text-slate-500">
                      Hentikan sistem dari dashboard sebelum mengganti sumber
                      kamera.
                    </p>
                  )}
                </div>

                <AnimatePresence>
                  {showEditor && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-5 bg-white border border-indigo-500/30 rounded-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                      <div className="flex justify-between gap-4 mb-5">
                        <div>
                          <h3 className="font-medium">
                            {configured ? "Edit Kamera" : "Tambah Kamera"}
                          </h3>
                          <p className="text-sm text-slate-500 mt-1">
                            Atur sumber video Event Visitor.
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Tutup editor kamera"
                          className={secondary}
                          disabled={busy}
                          onClick={() => setShowEditor(false)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <form onSubmit={saveCamera}>
                        <fieldset
                          disabled={disabled || running}
                          className="space-y-4 disabled:opacity-50"
                        >
                          <label className="block text-sm text-slate-500">
                            <span className="block mb-2 font-medium">
                              Webcam Index / RTSP URL / Video
                            </span>
                            <input
                              required
                              autoComplete="off"
                              className={`${input} font-mono text-sm`}
                              placeholder="0 atau rtsp://host:554/stream"
                              value={cameraSource}
                              onChange={(e) => setCameraSource(e.target.value)}
                            />
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] uppercase tracking-widest text-slate-500">
                              Quick Test:
                            </span>
                            <button
                              type="button"
                              className={secondary}
                              onClick={() => setCameraSource("0")}
                            >
                              Webcam (0)
                            </button>
                            <button
                              type="button"
                              className={secondary}
                              onClick={() =>
                                setCameraSource(
                                  "./samples/14746057_2160_3840_60fps.mp4",
                                )
                              }
                            >
                              Sample Video
                            </button>
                          </div>
                          <button
                            type="submit"
                            className={primary}
                            disabled={!cameraSource.trim()}
                          >
                            <Save size={18} />
                            Simpan Kamera
                          </button>
                        </fieldset>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            <section id="preview" className={`${panel} scroll-mt-24`}>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">Live Preview</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Preview menggunakan pengaturan yang sudah disimpan.
                  </p>
                </div>
                <button
                  type="button"
                  className={secondary}
                  aria-label="Muat ulang preview"
                  disabled={!running || Boolean(connectionError)}
                  onClick={() => {
                    setStreamFailed(false);
                    setStreamKey((value) => value + 1);
                  }}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="p-6">
                <div className="aspect-video bg-slate-950 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                  {running && !connectionError && !streamFailed ? (
                    // MJPEG streams require a native image element without Next.js optimization.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${status?.session_id}-${streamKey}`}
                      src={`${API_BASE}/stream`}
                      alt="Live kamera Event Visitor dengan garis penghitung"
                      className="w-full h-full object-contain"
                      onError={() => setStreamFailed(true)}
                    />
                  ) : (
                    <div className="text-center px-6 py-8 text-slate-400">
                      <Video
                        size={38}
                        strokeWidth={1}
                        className="mx-auto mb-3"
                      />
                      <p className="text-sm font-medium text-slate-200">
                        {connectionError
                          ? "Koneksi kamera tidak tersedia"
                          : streamFailed && running
                            ? "Preview tidak dapat dimuat"
                            : "Video stream belum berjalan"}
                      </p>
                      <p className="text-xs mt-2 leading-relaxed">
                        {connectionError
                          ? "Coba hubungkan kembali untuk melihat status terbaru."
                          : streamFailed && running
                            ? "Klik muat ulang preview untuk mencoba kembali."
                            : "Mulai sistem dari dashboard untuk melihat garis penghitung."}
                      </p>
                      {!running && (
                        <Link
                          href="/events"
                          className="mt-4 inline-flex items-center rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
                        >
                          Buka Dashboard
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {notice && (
          <motion.div
            role={notice.error ? "alert" : "status"}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 left-6 sm:left-auto sm:max-w-md px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3 z-50 text-sm border ${notice.error ? "bg-red-950 text-red-200 border-red-500/30" : "bg-white text-slate-900 border-white"}`}
          >
            {notice.error ? (
              <Info size={18} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2
                size={18}
                className="shrink-0 mt-0.5 text-emerald-600"
              />
            )}
            <span className="break-words">{notice.message}</span>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => setNotice(null)}
              className="ml-auto shrink-0"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
