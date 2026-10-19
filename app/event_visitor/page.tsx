"use client";
import { useConfirmation } from "../../components/ui/confirmation";
import { apiErrorMessage } from "../../components/auth/api-error";
import { visitorFetch, downloadVisitorReport } from "../../components/auth/visitor-api";
import { Button, ButtonLink, buttonStyles } from "../../components/ui/button";
import { Field, Select } from "../../components/ui/field";
import { InfoRow, Page, PageHeading, Panel, Toolbar } from "../../components/ui/layout";
import { cx, ui } from "../../components/ui/styles";
import { RowMenu } from "../../components/ui/row-menu";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Download,
  Maximize,
  Pause,
  Pencil,
  Play,
  Radio,
  RefreshCw,
  Sliders,
  Square,
  Video,
} from "lucide-react";
import VisitorRecords from "../../components/visitor-records";
import { connectStatusStream } from "../../components/events/status-stream";
import { useAccess } from "../../components/auth/access";
import EventVideoDetection from "../../components/event-video-detection";
import EventsManager from "../../components/events/events-manager";
import { toast } from "../../components/ui/toast";
import Modal from "../../components/ui-modal";
import HourlyVisitorStatistics from "../../components/hourly-visitor-statistics";
import { getAuthHeaders, getAuthToken } from "../../components/auth/auth-api";
import WebRTCPlayer, { DetectionBox } from "../../components/camera/webrtc-player";
const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor`;
const EVENTS_API = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/events`;
type VisitorEvent = {
  id: string;
  name: string;
  event_date?: string;
  event_end_date?: string;
  created_at?: string;
  event_start?: string;
  event_end?: string;
  location?: string;
  capacity?: number;
};
type UnresolvedCrossings = {
  in: number;
  out: number;
  reasons?: { reason: string; count: number; message: string }[];
};
type InferenceDevice = { name: string; device: string; initial_device?: string; fallback_reason?: string | null };
type Status = {
  inference_devices?: InferenceDevice[];
  inference_runtime?: { torch_version: string; cuda_built: boolean; cuda_available: boolean; cuda_version: string | null; mps_available: boolean } | null;
  running: boolean;
  starting?: boolean;
  startup?: { state: string; message: string; error?: string | null };
  camera_source: string | number | null;
  session_id: string | null;
  status?: string;
  unique_visitor_count: number;
  total_count: number;
  in_count: number;
  out_count: number;
  unresolved_crossings?: UnresolvedCrossings;
  male_count: number;
  female_count: number;
  unknown_gender_count: number;
  timezone?: string;
  last_visitor_at: string | null;
  last_error?: string;
  last_count_update?: {
    id: string;
    crossing_to_saved_ms: number;
    recognition_wait_ms: number;
    save_ms: number;
  };
  line_position?: number;
  line_orientation?: string;
  line_angle?: number;
  reverse_direction?: boolean;
  two_line_counting?: boolean;
  zone_width_ratio?: number;
  mirror?: boolean;
  counting_frame_size?: { width: number; height: number };
  counting_mode?: "line" | "zone";
  zone_occupancy?: { zone: [number, number, number, number]; count: number | null; stale: boolean; age_seconds: number | null } | null;
  cameras?: {
    counting_mode?: "line" | "zone";
    zone_occupancy?: { zone: [number, number, number, number]; count: number | null; stale: boolean; age_seconds: number | null } | null;
    inference_devices?: InferenceDevice[];
    inference_metrics?: { ai_fps: number; completed_frames: number; mean_ms?: Record<string, number> };
    camera_id: string;
    counting_direction?: string;
    counting_frame_size?: { width: number; height: number };
    body_reid_enabled?: boolean;
    body_reid_error?: string | null;
    unresolved_crossings?: UnresolvedCrossings;
    name: string;
    running: boolean;
    connection_state?: "online" | "connecting" | "reconnecting" | "stopped";
    reconnect_attempts?: number;
    last_frame_at?: string | null;
    last_error?: string;
    mediamtx_path?: string;
    line_position?: number;
    line_orientation?: string;
    line_angle?: number;
    reverse_direction?: boolean;
    two_line_counting?: boolean;
    zone_width_ratio?: number;
    mirror?: boolean;
    stream_urls?: {
      webrtc_whep?: string;
      webrtc_player?: string;
      hls?: string;
      rtsp_internal?: string;
    };
    detections?: DetectionBox[];
  }[];
};
function getCompanyId() {
  try {
    const user = JSON.parse(localStorage.getItem("user_info") || "null");
    return (
      (user?.workspace_id || user?.company_id || (user?.account_type === "personal" ? user?.id : "")) ||
      localStorage.getItem("cctv_company_id") ||
      ""
    );
  } catch {
    return "";
  }
}
export default function EventVisitorPage({
  eventId: fixedEventId = "",
}: {
  eventId?: string;
}) {
  const { can } = useAccess();
  const { confirm, confirmation } = useConfirmation();
  const [videoOpen, setVideoOpen] = useState(false);
  const [events, setEvents] = useState<VisitorEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(fixedEventId);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [eventVersion, setEventVersion] = useState(0);
  const [resetVersion, setResetVersion] = useState(0);
  const [resetError, setResetError] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [actionError, setActionError] = useState("");
  const [streamErrors, setStreamErrors] = useState<Record<string, boolean>>({});
  const [cameraStreamKeys, setCameraStreamKeys] = useState<Record<string, number>>({});
  const [cameraAiDetection, setCameraAiDetection] = useState<Record<string, boolean>>({});
  const [detectionSnapshot, setDetectionSnapshot] = useState<{ eventId: string; cameras: Record<string, DetectionBox[]> } | null>(null);
  const cameraDetections = status?.running && detectionSnapshot?.eventId === selectedEventId ? detectionSnapshot.cameras : {};
  const [streamKey, setStreamKey] = useState(0);
  const cameraRetryKey = (status?.cameras || []).filter((camera) => streamErrors[camera.camera_id] && camera.running && (!camera.connection_state || camera.connection_state === "online")).map((camera) => camera.camera_id).join(",");
  useEffect(() => {
    if (!cameraRetryKey) return;
    const retryIds = cameraRetryKey.split(",");
    const timer = setTimeout(() => {
      setStreamErrors((previous) => {
        const next = { ...previous };
        retryIds.forEach((id) => { next[id] = false; });
        return next;
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [cameraRetryKey]);
  const stage = useRef<HTMLDivElement>(null);
  const countReceived = useRef<{ id: string; at: number } | null>(null);
  const [renderMeasurement, setRenderMeasurement] = useState<{ id: string; ms: number } | null>(null);
  const applyStatus = useCallback((next: Status) => {
    const id = next?.last_count_update?.id;
    if (id && countReceived.current?.id !== id) countReceived.current = { id, at: performance.now() };
    setStatus(next);
  }, []);
  useEffect(() => {
    const received = countReceived.current;
    if (!received || received.id !== status?.last_count_update?.id) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        setRenderMeasurement({ id: received.id, ms: Math.round(performance.now() - received.at) });
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [status?.last_count_update?.id]);
  const refreshStatus = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const cid = getCompanyId();
        if (!cid) throw new Error("Workspace belum tersedia.");
        const query = selectedEventId
          ? `&event_id=${encodeURIComponent(selectedEventId)}`
          : "";
        const response = await visitorFetch(
          `${API_BASE}/status?company_id=${encodeURIComponent(cid)}${query}`,
          { cache: "no-store", signal, headers: getAuthHeaders() },
        );
        if (!response.ok)
          throw new Error("Status kamera belum dapat dimuat. Coba lagi.");
        const payload = await response.json();
        if (!signal?.aborted) {
          applyStatus(payload.result);
          setConnectionError("");
        }
      } catch (error) {
        if (!signal?.aborted)
          setConnectionError(
            error instanceof Error
              ? error.message
              : "Koneksi kamera tidak tersedia.",
          );
      }
    },
    [selectedEventId, applyStatus],
  );
  useEffect(() => {
    const controller = new AbortController();

    const cid = getCompanyId();
    const initial = setTimeout(() => {
      setStatus(null);
      if (!cid) setConnectionError("Workspace belum tersedia.");
      else void refreshStatus(controller.signal);
    }, 0);
    if (!cid) {
      return () => clearTimeout(initial);
    }

    const token = getAuthToken();
    const query = [
      `company_id=${encodeURIComponent(cid)}`,
      selectedEventId ? `event_id=${encodeURIComponent(selectedEventId)}` : "",
      token ? `token=${encodeURIComponent(token)}` : "",
    ]
      .filter(Boolean)
      .join("&");

    const streamUrl = `${API_BASE}/status/stream?${query}`;

    const disconnect = connectStatusStream<Status>({
      url: streamUrl,
      refresh: (signal) => refreshStatus(signal),
      open: () => setConnectionError(""),
      receive: (nextStatus) => {
        controller.abort();
        applyStatus(nextStatus);
        setConnectionError("");
      },
    });

    return () => {
      clearTimeout(initial);
      controller.abort();
      disconnect();
    };
  }, [selectedEventId, refreshStatus, applyStatus]);

  // Live AI detection boxes SSE stream (<100ms updates)
  useEffect(() => {
    if (!selectedEventId || !status?.running) {
      return;
    }
    const cid = getCompanyId();
    if (!cid) return;
    const token = getAuthToken();
    const query = [
      `company_id=${encodeURIComponent(cid)}`,
      `event_id=${encodeURIComponent(selectedEventId)}`,
      token ? `token=${encodeURIComponent(token)}` : "",
    ]
      .filter(Boolean)
      .join("&");

    const detUrl = `${API_BASE}/detections/stream?${query}`;
    let es: EventSource | null = null;
    try {
      es = new EventSource(detUrl);
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.cameras) {
            setDetectionSnapshot({ eventId: selectedEventId, cameras: payload.cameras });
          }
        } catch {
          // ignore parse errors
        }
      };
      es.onerror = () => {
        // EventSource will auto-reconnect
      };
    } catch {
      // ignore
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [selectedEventId, status?.running]);

  useEffect(() => {
    const controller = new AbortController();
    visitorFetch(`${EVENTS_API}?company_id=${encodeURIComponent(getCompanyId())}`, {
      signal: controller.signal,
      headers: getAuthHeaders(),
    })
      .then((response) => {
        if (!response.ok)
          throw new Error("Informasi event belum dapat dimuat.");
        return response.json();
      })
      .then((payload) =>
        setEvents(Array.isArray(payload.result) ? payload.result : []),
      )
      .catch((error) => {
        if (!controller.signal.aborted) setActionError(error.message);
      });
    const initial = setTimeout(() => {
      if (!fixedEventId)
        setSelectedEventId(
          localStorage.getItem("event_visitor_event_id") || "",
        );
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(initial);
    };
  }, [fixedEventId, eventVersion]);
  async function action(command: "start" | "pause" | "stop" | "restart") {
    if (
      command === "stop" &&
      !await confirm({ title: status?.starting ? "Batalkan persiapan" : "Hentikan monitoring", confirmLabel: "Hentikan", message: status?.starting ? "Batalkan persiapan event ini? Pemuatan model yang sedang berlangsung akan diselesaikan sebelum dihentikan." : "Stop monitoring event ini? Sesi aktif akan ditandai selesai." })
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      if (!selectedEventId)
        throw new Error("Pilih event sebelum memulai monitoring.");
      const starting = command === "start" || command === "restart";
      const response = await visitorFetch(
        `${API_BASE}/${command === "restart" ? "start" : command}?company_id=${encodeURIComponent(getCompanyId())}&event_id=${encodeURIComponent(selectedEventId)}`,
        {
          method: "POST",
          headers: getAuthHeaders(starting ? { "Content-Type": "application/json" } : {}),
          ...(starting
            ? {
                body: JSON.stringify({ event_id: selectedEventId, background: true, restart: command === "restart" }),
              }
            : {}),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(payload, response.status, "Perintah belum berhasil."));
      setStreamErrors({});
      setStreamKey((key) => key + 1);
      if (payload?.result) applyStatus(payload.result);
      toast.success(command === "restart" ? "Kamera sedang dimulai ulang. Data hitungan tetap tersimpan." : command === "start" ? "Persiapan monitoring dimulai." : payload?.result?.starting ? "Persiapan sedang dibatalkan." : { pause: "Monitoring dijeda.", stop: "Monitoring dihentikan." }[command]);
      await refreshStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Perintah gagal.";
      setActionError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  const refreshVideoResults = useCallback(() => {
    setResetVersion((value) => value + 1);
    void refreshStatus();
  }, [refreshStatus]);

  const currentEvent = events.find((event) => event.id === selectedEventId);
  const running = Boolean(status?.running);
  const preparing = Boolean(status?.starting);
  const cameraList =
    status?.cameras && status.cameras.length > 0
      ? status.cameras
      : [
          {
            camera_id: "default",
            name: "Kamera Utama",
            running: Boolean(status?.running),
            last_error: status?.last_error,
            unresolved_crossings: status?.unresolved_crossings,
          },
        ];
  const gridColsClass =
    cameraList.length === 1
      ? "grid-cols-1"
      : "grid-cols-1 md:grid-cols-2";
  const inside = Math.max(0, status?.total_count || 0);
  const value = (count?: number) =>
    status ? `${(count || 0).toLocaleString("id-ID")} Orang` : "-";
  const demographics = [
    { label: "Laki-laki", count: status?.male_count || 0 },
    { label: "Perempuan", count: status?.female_count || 0 },
    { label: "Belum teridentifikasi (Unknown)", count: status?.unknown_gender_count || 0 },
  ];
  const genderTotal = demographics.reduce((sum, item) => sum + item.count, 0);
  const row = (label: string, content: string) => (
    <InfoRow key={label}>
      <span>{label}</span>
      <span>{content}</span>
    </InfoRow>
  );
  const resetEvent = async () => {
    if (busy || !fixedEventId) return;
    setBusy(true);
    setResetError("");
    try {
      const response = await visitorFetch(`${EVENTS_API}/${encodeURIComponent(fixedEventId)}/reset`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : "Event belum dapat direset. Coba lagi.");
      }
      setStatus(null);
      setDetectionSnapshot(null);
      setStreamErrors({});
      setResetVersion((value) => value + 1);
      setStreamKey((value) => value + 1);
      setResetOpen(false);
      setVideoOpen(false);
      toast.success("Data event berhasil direset.");
      await refreshStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset event gagal.";
      setResetError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page className="space-y-6">
      {resetOpen && (
        <Modal title="Reset data event?" size="small" busy={busy} onClose={() => setResetOpen(false)}>
          <div className="space-y-4 p-6">
            <p>Monitoring akan dihentikan. Semua hitungan, riwayat capture, foto, dan identitas pengunjung event ini akan dihapus permanen.</p>
            <p className="text-sm text-neutral-600">Nama, jadwal, pengaturan, dan kamera event tetap tersimpan. Jadwal otomatis yang aktif dapat menjalankan monitoring kembali.</p>
            {resetError && <p role="alert" className={ui.error}>{resetError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" disabled={busy} onClick={() => setResetOpen(false)}>Batal</Button>
              <Button type="button" variant="stop" disabled={busy} onClick={() => void resetEvent()}>{busy ? "Mereset…" : "Hapus Data dan Reset"}</Button>
            </div>
          </div>
        </Modal>
      )}
      <PageHeading>
        <div>
          <p className={ui.eyebrow}>MANAJEMEN EVENT</p>
          <h1>{fixedEventId ? "Detail Event" : "Monitor Pengunjung"}</h1>
          <p className={ui.pageDescription}>
            Pantau arus masuk, keluar, dan aktivitas pengunjung secara langsung.
          </p>
        </div>
        {fixedEventId && (
          <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={!can("videos.analyze")} aria-expanded={videoOpen} onClick={() => setVideoOpen((open) => !open)}><Video size={16} /> {videoOpen ? "Tutup Deteksi Video" : "Upload Video"}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setEditOpen(true)}>
            <Pencil size={16} /> Edit Event
          </Button>
          {editOpen && <EventsManager editEventId={fixedEventId} onClose={() => setEditOpen(false)} onSaved={() => { setEventVersion((value) => value + 1); void refreshStatus(); }} />}
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setResetError(""); setResetOpen(true); }}>
            <RefreshCw size={16} /> Reset Event
          </Button>
          <RowMenu
            trigger={
              <span className={cx(buttonStyles({ variant: "outline", className: "w-auto! h-auto!" }), "inline-flex items-center gap-2")}>
                <Download size={16} />
                Download Report
              </span>
            }
          >
            {["pdf", "excel", "csv"].map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => {
                  void downloadVisitorReport(
                    `${EVENTS_API}/${encodeURIComponent(fixedEventId)}/report?company_id=${encodeURIComponent(getCompanyId())}&format=${format}`,
                    `event-${fixedEventId}.${format === "excel" ? "xlsx" : format}`,
                  ).catch((error) => setActionError(error.message));
                }}
              >
                {format === "excel"
                  ? "Excel (.xlsx)"
                  : `${format.toUpperCase()} (.${format})`}
              </button>
            ))}
          </RowMenu>
          </div>
        )}
      </PageHeading>
      {preparing && (
        <p role="status" className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          {status?.startup?.message || "Menyiapkan monitoring"}. Proses pertama dapat memerlukan waktu untuk memuat model.
        </p>
      )}
      {fixedEventId && can("videos.analyze") && videoOpen && <EventVideoDetection key={fixedEventId} eventId={fixedEventId} onSaved={refreshVideoResults} />}
      {status && (status.in_count || 0) === 0 && cameraList.every((camera) => camera.counting_direction === "out") && (
        <p role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Event ini belum memiliki catatan Masuk. Keluar hanya dihitung untuk pengunjung yang sudah masuk di event yang sama. Gunakan satu event untuk kamera Masuk dan Keluar.
        </p>
      )}
      {!fixedEventId && (
        <Toolbar>
          <Field>
            Pilih Event
            <Select
              className="w-auto!"
              value={selectedEventId}
              disabled={running || preparing}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                localStorage.setItem("event_visitor_event_id", e.target.value);
              }}
            >
              <option value="">Pilih event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </Select>
          </Field>
          <ButtonLink href="/events?create=1">
            Buat Event Baru
          </ButtonLink>
        </Toolbar>
      )}
      {(connectionError || actionError || status?.last_error) && (
        <p role="alert" className={ui.error}>
          {connectionError || actionError || status?.last_error}{" "}
          <button className="underline" onClick={() => refreshStatus()}>
            Muat ulang
          </button>
        </p>
      )}
      {currentEvent?.capacity && inside > currentEvent.capacity ? (
        <p role="alert" className={ui.error}>
          Jumlah pengunjung ({inside}) melebihi kapasitas event (
          {currentEvent.capacity}).
        </p>
      ) : null}
      <div className="grid items-start gap-6 min-[900px]:grid-cols-2 [&_[data-slot=panel]]:rounded-xl [&_[data-slot=panel]]:p-4 [&_[data-slot=panel]]:shadow-none [&_h2]:mb-2">
        <Panel className="p-0! min-[900px]:col-span-2 overflow-hidden border border-[#e2e8f0]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="m-0! text-base font-semibold text-[#101c30]">Live Monitoring Kamera</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <span className={`inline-block size-2 rounded-full ${running ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                  {preparing ? status?.startup?.message : running ? `${cameraList.length} Kamera Aktif` : "Standby"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#52647f]">
                Pantau semua kamera dalam satu event. Pengunjung dicocokkan melalui wajah atau tubuh agar tidak dihitung sebagai orang baru di setiap kamera.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#52647f]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="size-2.5 rounded-[2px] bg-[#1e90ff] ring-1 ring-blue-500/50" />
                  <span>Kotak Biru: Laki-laki</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="size-2.5 rounded-[2px] bg-[#ff69b4] ring-1 ring-pink-500/50" />
                  <span>Kotak Pink: Perempuan</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="size-2.5 rounded-[2px] bg-[#eab308] ring-1 ring-yellow-500/50" />
                  <span>Kuning: Gender belum diketahui</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="size-2.5 rounded-[2px] bg-cyan-300 ring-1 ring-cyan-400/50" />
                  <span>Biru muda: Batas penghitungan</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-8! px-3! text-xs! w-auto!"
                onClick={async () => {
                  try {
                    if (document.fullscreenElement) {
                      await document.exitFullscreen();
                    } else {
                      await stage.current?.requestFullscreen();
                    }
                  } catch {
                    setActionError("Layar penuh tidak tersedia di browser ini.");
                  }
                }}
              >
                <Maximize size={13} className="mr-1.5" />
                Fullscreen Grid
              </Button>
            </div>
          </div>

          <div
            ref={stage}
            className="group/camera relative bg-[#0b1320] p-3 md:p-4 [&:fullscreen]:flex [&:fullscreen]:h-full [&:fullscreen]:flex-col [&:fullscreen]:overflow-y-auto [&:fullscreen]:p-4 [&:fullscreen]:bg-[#0b1320]"
          >
            <div className="group-[:fullscreen]/camera:grid group-[:fullscreen]/camera:gap-4 group-[:fullscreen]/camera:flex-1 group-[:fullscreen]/camera:items-start min-[900px]:group-[:fullscreen]/camera:grid-cols-[minmax(0,1fr)_280px]">
            <div className={`grid min-w-0 gap-3.5 ${gridColsClass} w-full`}>
              {cameraList.map((camera, index) => {
                const camId = camera.camera_id;
                const camQuery =
                  camId && camId !== "default"
                    ? `&camera_id=${encodeURIComponent(camId)}`
                    : "";
                const token = getAuthToken();
                const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
                const streamUrl = `${API_BASE}/stream?company_id=${encodeURIComponent(getCompanyId())}&event_id=${encodeURIComponent(selectedEventId)}${camQuery}${tokenQuery}`;
                const hasError = Boolean(streamErrors[camId]);
                const isRunning = running && camera.running !== false;
                const detectionMessages = [...new Set((cameraDetections[camId] || camera.detections || []).map((detection) => detection.counting_message).filter(Boolean))].slice(0, 3);

                return (
                  <div
                    key={camId}
                    id={`camera-cell-${camId}`}
                    className="group/cell relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101c30] shadow-md"
                  >
                    {/* Camera Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded bg-white/10 text-[11px] font-semibold text-white/90">
                          {index + 1}
                        </span>
                        {camera.inference_metrics && <span className="rounded bg-slate-800 px-2 py-1 text-slate-200" title="FPS inferensi AI yang selesai, bukan FPS video">AI {camera.inference_metrics.ai_fps.toFixed(1)} FPS</span>}
                        {camera.counting_mode === "zone" && <span className="rounded bg-cyan-950 px-2 py-1 text-cyan-200">Zona: {camera.zone_occupancy?.stale || !camera.zone_occupancy ? "Belum tersedia" : `${camera.zone_occupancy.count} orang`}</span>}
                        <span className="max-w-[200px] truncate font-medium text-white" title={camera.name}>
                          {camera.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Tab Realtime dan AI Detection di sebelah Live */}
                        {isRunning && (
                          <div className="flex items-center rounded-lg bg-black/60 p-0.5 border border-white/15 backdrop-blur-sm">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCameraAiDetection((prev) => ({ ...prev, [camId]: false }));
                              }}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                                !(cameraAiDetection[camId] ?? true)
                                  ? "bg-cyan-500 text-white shadow-sm"
                                  : "text-slate-300 hover:text-white hover:bg-white/10"
                              }`}
                              title="Tampilan Bersih Realtime (tanpa kotak deteksi)"
                            >
                              <Radio className="size-3 text-emerald-400 animate-pulse" />
                              <span>Realtime</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCameraAiDetection((prev) => ({ ...prev, [camId]: true }));
                              }}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                                cameraAiDetection[camId] ?? true
                                  ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                                  : "text-slate-300 hover:text-white hover:bg-white/10"
                              }`}
                              title="AI Detection (Bounding Box: Biru=Pria, Pink=Wanita, Kuning=Unknown)"
                            >
                              <Sliders className="size-3" />
                              <span>AI Detection</span>
                            </button>
                          </div>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isRunning && !hasError && !connectionError
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-white/10 text-slate-400"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isRunning && !hasError && !connectionError
                                ? "bg-emerald-400 animate-pulse"
                                : "bg-slate-500"
                            }`}
                          />
                          {isRunning && !hasError && !connectionError ? "LIVE" : "OFFLINE"}
                        </span>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                          title="Refresh / Reconnect stream kamera ini"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStreamErrors((prev) => ({ ...prev, [camId]: false }));
                            setCameraStreamKeys((previous) => ({ ...previous, [camId]: (previous[camId] || 0) + 1 }));
                          }}
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                          title="Fullscreen kamera ini"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const el = document.getElementById(`camera-cell-${camId}`);
                            try {
                              if (document.fullscreenElement) {
                                await document.exitFullscreen();
                              } else if (el) {
                                await el.requestFullscreen();
                              }
                            } catch {
                              setActionError("Fullscreen tidak didukung di browser ini.");
                            }
                          }}
                        >
                          <Maximize size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Camera Stream Frame */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black grid place-items-center">
                      {isRunning && !connectionError && !hasError ? (
                        <WebRTCPlayer
                          key={`${streamKey}-${camId}-${cameraStreamKeys[camId] || 0}`}
                          whepUrl={camera.stream_urls?.webrtc_whep}
                          webrtcPlayerUrl={camera.stream_urls?.webrtc_player}
                          hlsUrl={camera.stream_urls?.hls}
                          fallbackStreamUrl={streamUrl}
                          preferredMode="webrtc"
                          detections={cameraDetections[camId] || camera.detections || []}
                          showDetections={cameraAiDetection[camId] ?? true}
                          onToggleDetections={(enabled) => {
                            setCameraAiDetection((prev) => ({ ...prev, [camId]: enabled }));
                          }}
                          hideInternalSwitcher
                          cameraName={camera.name}
                          className="size-full"
                          lineConfig={{
                            countingMode: camera.counting_mode,
                            occupancyZone: camera.zone_occupancy?.zone,
                            countingDirection: camera.counting_direction,
                            frameSize: camera.counting_frame_size || status?.counting_frame_size,
                            linePosition: camera.line_position ?? status?.line_position ?? 0.5,
                            lineOrientation: camera.line_orientation ?? status?.line_orientation ?? "horizontal",
                            lineAngle: camera.line_angle ?? status?.line_angle ?? 0.0,
                            reverseDirection: camera.reverse_direction ?? status?.reverse_direction ?? false,
                            twoLineCounting: camera.two_line_counting ?? status?.two_line_counting ?? true,
                            zoneWidthRatio: camera.zone_width_ratio ?? status?.zone_width_ratio ?? 0.20,
                            mirror: camera.mirror ?? status?.mirror ?? false,
                          }}
                          onStatusChange={(s) => {
                            const isErr = s === "error";
                            setStreamErrors((prev) =>
                              prev[camId] === isErr
                                ? prev
                                : { ...prev, [camId]: isErr },
                            );
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400">
                          <Video size={30} className="mb-2 text-slate-500" />
                          <p className="text-xs">
                            {hasError
                              ? "Stream tidak dapat dimuat"
                              : connectionError
                                ? "Koneksi terputus"
                                : "Monitoring belum berjalan"}
                          </p>
                          {hasError && (
                            <Button
                              variant="outline"
                              className="mt-2.5 h-7! w-auto! border-white/20 px-2.5! text-xs! text-white hover:bg-white/10"
                              onClick={() => {
                                setStreamErrors((prev) => ({ ...prev, [camId]: false }));
                                setCameraStreamKeys((previous) => ({ ...previous, [camId]: (previous[camId] || 0) + 1 }));
                              }}
                            >
                              <RefreshCw size={12} className="mr-1" />
                              Muat ulang
                            </Button>
                          )}
                        </div>
                      )}

                      {camera.last_error && (
                        <div className="absolute inset-x-2 bottom-2 rounded border border-rose-800 bg-rose-950/80 px-2 py-1 text-[11px] text-rose-200">
                          {camera.last_error}
                        </div>
                      )}
                    </div>
                    {isRunning && camera.connection_state && camera.connection_state !== "online" && (
                      <p role="status" className="border-t border-white/10 bg-[#101c30] px-3 py-2 text-xs text-amber-200">
                        {camera.connection_state === "reconnecting" ? "Kamera terputus. Menghubungkan kembali otomatis…" : camera.connection_state === "stopped" ? "Kamera offline. Hentikan lalu mulai monitoring untuk mencoba kembali." : "Menunggu gambar kamera…"}
                      </p>
                    )}
                    {isRunning && (!camera.connection_state || camera.connection_state === "online") && <div className="border-t border-white/10 bg-[#101c30] px-3 py-2 text-xs text-slate-200">
                      {camera.body_reid_enabled === false && <p className="mb-1 text-amber-200">Pencocokan tubuh tidak aktif. Wajah diperlukan untuk mencocokkan pengunjung antar kamera.</p>}
                      {detectionMessages.length === 0 && <p>Belum ada pengunjung yang terdeteksi.</p>}
                      {detectionMessages.map((message) => <p key={message}>{message}</p>)}
                    </div>}
                    {camera.unresolved_crossings && (camera.unresolved_crossings.in > 0 || camera.unresolved_crossings.out > 0) && (
                      <div className="border-t border-white/10 bg-[#101c30] px-3 py-2 text-xs text-amber-200">
                        <p>Lintasan belum terhitung: Masuk {camera.unresolved_crossings.in} · Keluar {camera.unresolved_crossings.out}.</p>
                        {camera.unresolved_crossings.reasons?.length ? (
                          <ul className="mt-1 space-y-1">
                            {camera.unresolved_crossings.reasons.map((item) => (
                              <li key={item.reason}>{item.message}: {item.count}</li>
                            ))}
                          </ul>
                        ) : <p>Menunggu kecocokan atau bukti yang lebih jelas.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <aside
              aria-label="Ringkasan pengunjung event"
              className="hidden min-w-0 rounded-xl border border-white/10 bg-[#101c30] p-4 text-white group-[:fullscreen]/camera:block"
            >
              <h2 className="m-0! text-base! font-semibold text-white!">Statistik Pengunjung</h2>
              {currentEvent?.name && (
                <p className="mt-1 break-words text-sm text-slate-300">{currentEvent.name}</p>
              )}
              <p className="mt-2 text-xs text-slate-300">
                {connectionError
                  ? "Koneksi terputus. Angka terakhir belum diperbarui."
                  : !status
                    ? "Memuat statistik pengunjung…"
                    : "Total event dari seluruh kamera · Diperbarui real-time"}
              </p>
              {status?.cameras?.some(camera => camera.counting_mode === "zone") && <div className="mt-4 rounded-lg border border-cyan-400/30 p-3 text-sm">
                <p className="font-semibold text-cyan-200">Okupansi zona saat ini</p>
                <p className="mt-1 text-xs text-slate-300">Orang yang terlihat di setiap kamera. Bukan total tiket atau pengunjung unik; zona antarkamera tidak dijumlahkan.</p>
                {status.cameras.filter(camera => camera.counting_mode === "zone").map(camera => <p key={camera.camera_id} className="mt-2 flex justify-between gap-3"><span>{camera.name}</span><span>{camera.zone_occupancy?.stale || !camera.zone_occupancy ? "Data belum tersedia" : `${camera.zone_occupancy.count} orang`}</span></p>)}
              </div>}
              <dl className="mt-4 divide-y divide-white/10">
                {[
                  { label: "Total Masuk", count: status?.in_count },
                  { label: "Total Keluar", count: status?.out_count },
                  { label: "Di dalam (berdasarkan masuk − keluar)", count: inside },
                ].map((item) => (
                  <div key={item.label} className="py-3 first:pt-0">
                    <dt className="text-sm text-slate-300">{item.label}</dt>
                    <dd className="mt-1 break-words text-2xl font-semibold tabular-nums">
                      {value(item.count)}
                    </dd>
                  </div>
                ))}
                <div className="pt-3">
                  <dt className="text-sm text-slate-300">Kapasitas Tempat</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {!currentEvent
                      ? "-"
                      : currentEvent.capacity
                        ? `${currentEvent.capacity.toLocaleString("id-ID")} Orang`
                        : "Tidak dibatasi"}
                  </dd>
                </div>
              </dl>
              {currentEvent?.capacity && inside > currentEvent.capacity ? (
                <p role="alert" className="mt-4 rounded border border-rose-800 bg-rose-950 px-3 py-2 text-sm text-rose-200">
                  Jumlah pengunjung melebihi kapasitas event.
                </p>
              ) : null}
              <button
                type="button"
                className="mt-5 min-h-11 w-full rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={async () => {
                  try {
                    await document.exitFullscreen();
                  } catch {
                    setActionError("Tidak dapat keluar dari layar penuh. Tekan Esc untuk keluar.");
                  }
                }}
              >
                Keluar fullscreen
              </button>
              {actionError && <p role="alert" className="mt-3 text-sm text-rose-200">{actionError}</p>}
            </aside>
            </div>

            {/* Global Control Bar */}
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
              <span className="text-xs text-slate-300">
                Kontrol Sesi: Mulai atau jeda pemantauan pada semua kamera.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="play"
                  className="h-8! w-auto! px-3! text-xs!"
                  disabled={
                    busy ||
                    preparing ||
                    running ||
                    !status ||
                    status.camera_source == null ||
                    Boolean(connectionError)
                  }
                  onClick={() => action("start")}
                >
                  <Play size={13} className="mr-1" />
                  Mulai
                </Button>
                <Button
                  variant="pause"
                  className="h-8! w-auto! px-3! text-xs!"
                  disabled={busy || !running}
                  onClick={() => action("pause")}
                >
                  <Pause size={13} className="mr-1" />
                  Jeda
                </Button>
                <Button
                  variant="outline"
                  className="h-8! w-auto! px-3! text-xs!"
                  disabled={busy || preparing || !selectedEventId || !can("monitoring.control")}
                  onClick={() => void action("restart")}
                >
                  <RefreshCw size={13} className="mr-1" />
                  Restart kamera
                </Button>
                <Button
                  variant="stop"
                  className="h-8! w-auto! px-3! text-xs!"
                  disabled={busy || (!preparing && !status?.session_id)}
                  onClick={() => action("stop")}
                >
                  <Square size={13} className="mr-1" />
                  {preparing ? "Batalkan persiapan" : "Selesai"}
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6">
          {Boolean(status?.inference_devices?.length) && (
            <Panel>
              <h2>Perangkat Deteksi</h2>
              <p className="mb-3 text-sm text-slate-600">Device yang digunakan setiap model. Jika GPU gagal, model yang mendukung fallback mencoba kembali di CPU.</p>
              {status?.inference_runtime && (
                <p className="mb-3 text-xs text-slate-600">
                  PyTorch {status.inference_runtime.torch_version} · {status.inference_runtime.cuda_built ? `Runtime CUDA ${status.inference_runtime.cuda_version}` : "Runtime tanpa CUDA"}
                </p>
              )}
              {(status?.cameras?.some(camera => camera.inference_devices?.length)
                ? status.cameras.filter(camera => camera.inference_devices?.length).map(camera => ({ name: camera.name, devices: camera.inference_devices! }))
                : [{ name: "Mesin deteksi", devices: status?.inference_devices || [] }]
              ).map(group => (
                <div key={group.name} className="mb-3 last:mb-0">
                  <h3 className="mb-1 text-sm font-semibold">{group.name}</h3>
                  <dl className="divide-y divide-slate-100">
                    {group.devices.map(device => (
                      <div key={device.name} className="grid grid-cols-[1fr_auto] gap-x-3 py-2 text-sm">
                        <dt>{device.name}</dt><dd className="font-medium">{device.device.startsWith("cuda") ? "GPU NVIDIA (CUDA)" : device.device === "mps" ? "GPU Apple (MPS)" : device.device.startsWith("directml:") ? "GPU (DirectML)" : device.device === "cpu" ? "CPU" : device.device === "tensorflow" ? "TensorFlow" : device.device}</dd>
                        {device.fallback_reason && <dd className="col-span-2 mt-1 text-xs text-slate-600">{device.fallback_reason}</dd>}
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </Panel>
          )}
          <Panel>
            <h2>Informasi Event</h2>
            {row(
              "Tanggal Event",
              currentEvent?.event_date
                ? currentEvent.event_end_date && currentEvent.event_end_date !== currentEvent.event_date
                  ? `${new Date(currentEvent.event_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })} - ${new Date(currentEvent.event_end_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : new Date(currentEvent.event_date).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                : currentEvent?.created_at
                  ? new Date(currentEvent.created_at).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "-",
            )}
            {row(
              "Waktu Event",
              `${currentEvent?.event_start || "-"} - ${currentEvent?.event_end || "-"}`,
            )}
            {row("Tempat Event", currentEvent?.location || "-")}
            {row(
              "Kapasitas Tempat",
              currentEvent?.capacity
                ? `${currentEvent.capacity} Orang`
                : "Tidak dibatasi",
            )}
          </Panel>
          <Panel>
            <h2>Aktivitas Sesi</h2>
            {row("Total pengunjung", value(status?.unique_visitor_count))}
            {row(
              "Visitor Terakhir",
              status?.last_visitor_at
                ? new Date(status.last_visitor_at).toLocaleString("id-ID", {
                    timeZone: status.timezone || "Asia/Jakarta",
                  })
                : "Belum ada aktivitas",
            )}
            {status?.last_count_update && (
              <details className="mt-3 text-sm text-neutral-700">
                <summary className="cursor-pointer">Waktu pembaruan hitungan</summary>
                <p className="mt-2">Pencatatan terakhir: {Math.round(status.last_count_update.crossing_to_saved_ms)} ms sejak perlintasan terdeteksi.</p>
                <p>Pemrosesan pengunjung: {Math.round(status.last_count_update.recognition_wait_ms)} ms. Menyimpan: {Math.round(status.last_count_update.save_ms)} ms.</p>
                {renderMeasurement?.id === status.last_count_update.id && <p>Tampilan browser: {renderMeasurement.ms} ms setelah data diterima.</p>}
                <p className="mt-1 text-xs text-neutral-500">Belum termasuk jeda kamera sebelum deteksi dan waktu pengiriman melalui jaringan.</p>
              </details>
            )}
            {row("Session ID", status?.session_id || "-")}
          </Panel>
        </div>

        <div className="grid gap-6">
          <Panel>
            <h2>Statistik Pengunjung</h2>
            {row("Total Masuk", value(status?.in_count))}
            {row("Total Keluar", value(status?.out_count))}
            {row("Di dalam (masuk − keluar)", value(inside))}
          </Panel>
          <Panel>
            <h2>Profil Pengunjung</h2>
            {demographics.map((item) => (
              <InfoRow key={item.label}>
                <span>{item.label}</span>
                <strong className="ml-auto text-neutral-600">
                  {value(item.count)}
                </strong>
                <span className="w-14">
                  {status
                    ? `${genderTotal ? Math.round((item.count / genderTotal) * 100) : 0}%`
                    : "-"}
                </span>
              </InfoRow>
            ))}
          </Panel>
        </div>
      </div>
      <div className="pt-2">
        <VisitorRecords key={selectedEventId} companyId={getCompanyId()} eventId={selectedEventId} monitoring={Boolean(status?.running)} timezone={status?.timezone || "Asia/Jakarta"} cameras={status?.cameras || []} onChanged={() => { setResetVersion((value) => value + 1); void refreshStatus(); }} version={`${resetVersion}:${status?.in_count}:${status?.out_count}:${status?.last_visitor_at}`} />
      </div>
      <div className="pt-2">
      <HourlyVisitorStatistics
          key={`${selectedEventId}:${resetVersion}`}
          companyId={getCompanyId()}
          eventId={selectedEventId}
        />
      </div>
      {confirmation}
    </Page>
  );
}
