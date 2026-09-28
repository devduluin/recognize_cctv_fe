"use client";
import { Button, ButtonLink, buttonStyles } from "../../components/ui/button";
import { Field, Select } from "../../components/ui/field";
import { InfoRow, Page, PageHeading, Panel, Toolbar } from "../../components/ui/layout";
import { ui } from "../../components/ui/styles";
/* eslint-disable @next/next/no-img-element -- MJPEG streams must use a native image element. */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Download,
  Maximize,
  Pause,
  Play,
  RefreshCw,
  Square,
  Video,
} from "lucide-react";
import HourlyVisitorStatistics from "../../components/hourly-visitor-statistics";
const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor`;
const EVENTS_API = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/events`;
type VisitorEvent = {
  id: string;
  name: string;
  event_date?: string;
  created_at?: string;
  event_start?: string;
  event_end?: string;
  location?: string;
  capacity?: number;
};
type Status = {
  running: boolean;
  camera_source: string | number | null;
  session_id: string | null;
  status?: string;
  unique_visitor_count: number;
  total_count: number;
  in_count: number;
  out_count: number;
  male_count: number;
  female_count: number;
  unknown_gender_count: number;
  timezone?: string;
  last_visitor_at: string | null;
  last_error?: string;
  cameras?: { camera_id: string; name: string; running: boolean; last_error?: string }[];
};
function getCompanyId() {
  try {
    const user = JSON.parse(localStorage.getItem("user_info") || "null");
    return (
      (user?.account_type === "personal" ? user.id : user?.company_id) ||
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
  const [events, setEvents] = useState<VisitorEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(fixedEventId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [actionError, setActionError] = useState("");
  const [streamErrors, setStreamErrors] = useState<Record<string, boolean>>({});
  const [streamKey, setStreamKey] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const refreshStatus = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const cid = getCompanyId();
        if (!cid) throw new Error("Workspace belum tersedia.");
        const query = selectedEventId
          ? `&event_id=${encodeURIComponent(selectedEventId)}`
          : "";
        const response = await fetch(
          `${API_BASE}/status?company_id=${encodeURIComponent(cid)}${query}`,
          { cache: "no-store", signal },
        );
        if (!response.ok)
          throw new Error("Status kamera belum dapat dimuat. Coba lagi.");
        const payload = await response.json();
        if (!signal?.aborted) {
          setStatus(payload.result);
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
    [selectedEventId],
  );
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => {
      setStatus(null);
      void refreshStatus(controller.signal);
    }, 0);
    const timer = setInterval(() => refreshStatus(controller.signal), 3000);
    return () => {
      controller.abort();
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refreshStatus]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${EVENTS_API}?company_id=${encodeURIComponent(getCompanyId())}`, {
      signal: controller.signal,
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
  }, [fixedEventId]);
  async function action(command: "start" | "pause" | "stop") {
    if (
      command === "stop" &&
      !confirm("Stop monitoring event ini? Sesi aktif akan ditandai selesai.")
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      if (!selectedEventId)
        throw new Error("Pilih event sebelum memulai monitoring.");
      const response = await fetch(
        `${API_BASE}/${command}?company_id=${encodeURIComponent(getCompanyId())}&event_id=${encodeURIComponent(selectedEventId)}`,
        {
          method: "POST",
          ...(command === "start"
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event_id: selectedEventId }),
              }
            : {}),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          typeof payload.detail === "string"
            ? payload.detail
            : "Perintah belum berhasil.",
        );
      setStreamErrors({});
      setStreamKey((key) => key + 1);
      await refreshStatus();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Perintah gagal.",
      );
    } finally {
      setBusy(false);
    }
  }
  const currentEvent = events.find((event) => event.id === selectedEventId);
  const running = Boolean(status?.running);
  const cameraList =
    status?.cameras && status.cameras.length > 0
      ? status.cameras
      : [
          {
            camera_id: "default",
            name: "Kamera Utama",
            running: Boolean(status?.running),
            last_error: status?.last_error,
          },
        ];
  const gridColsClass =
    cameraList.length === 1
      ? "grid-cols-1"
      : "grid-cols-1 md:grid-cols-2";
  const inside = Math.max(
    0,
    (status?.in_count || 0) - (status?.out_count || 0),
  );
  const value = (count?: number) =>
    status ? `${(count || 0).toLocaleString("id-ID")} Orang` : "-";
  const demographics = [
    { label: "Laki-laki", count: status?.male_count || 0 },
    { label: "Perempuan", count: status?.female_count || 0 },
  ];
  const genderTotal = demographics.reduce((sum, item) => sum + item.count, 0);
  const row = (label: string, content: string) => (
    <InfoRow key={label}>
      <span>{label}</span>
      <span>{content}</span>
    </InfoRow>
  );
  return (
    <Page className="space-y-6">
      <PageHeading>
        <div>
          <p className={ui.eyebrow}>MANAJEMEN EVENT</p>
          <h1>{fixedEventId ? "Detail Event" : "Monitor Pengunjung"}</h1>
          <p className={ui.pageDescription}>
            Pantau arus masuk, keluar, dan aktivitas pengunjung secara langsung.
          </p>
        </div>
        {fixedEventId && (
          <details
            className={ui.rowMenu}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.open = false;
            }}
          >
            <summary data-slot="button" className={buttonStyles({ variant: "outline", className: "w-auto! h-auto!" })}>
              <Download size={16} />
              Download Report
            </summary>
            <div className={ui.rowMenuContent}>
              {["pdf", "excel", "csv"].map((format) => (
                <a
                  key={format}
                  href={`${EVENTS_API}/${encodeURIComponent(fixedEventId)}/report?company_id=${encodeURIComponent(getCompanyId())}&format=${format}`}
                  download
                >
                  {format === "excel"
                    ? "Excel (.xlsx)"
                    : `${format.toUpperCase()} (.${format})`}
                </a>
              ))}
            </div>
          </details>
        )}
      </PageHeading>
      {!fixedEventId && (
        <Toolbar>
          <Field>
            Pilih Event
            <Select
              className="w-auto!"
              value={selectedEventId}
              disabled={running}
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
                  {running ? `${cameraList.length} Kamera Aktif` : "Standby"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#52647f]">
                Tampilan grid otomatis semua kamera. Wajah yang cocok antar-kamera dalam event ini otomatis teridentifikasi sebagai satu pengunjung unik.
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
                  <span>Kuning: Belum Terdeteksi</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="size-2.5 rounded-[2px] bg-[#22c55e] ring-1 ring-green-500/50" />
                  <span>Hijau: Crossing Garis</span>
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
            className="group/camera relative bg-[#0b1320] p-3 md:p-4 [&:fullscreen]:flex [&:fullscreen]:h-full [&:fullscreen]:flex-col [&:fullscreen]:justify-between [&:fullscreen]:p-4 [&:fullscreen]:bg-[#0b1320]"
          >
            <div className={`grid gap-3.5 ${gridColsClass} w-full`}>
              {cameraList.map((camera, index) => {
                const camId = camera.camera_id;
                const camQuery =
                  camId && camId !== "default"
                    ? `&camera_id=${encodeURIComponent(camId)}`
                    : "";
                const streamUrl = `${API_BASE}/stream?company_id=${encodeURIComponent(getCompanyId())}&event_id=${encodeURIComponent(selectedEventId)}${camQuery}`;
                const hasError = Boolean(streamErrors[camId]);
                const isRunning = running && camera.running !== false;

                return (
                  <div
                    key={camId}
                    id={`camera-cell-${camId}`}
                    className="group/cell relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101c30] shadow-md"
                  >
                    {/* Camera Header Bar */}
                    <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded bg-white/10 text-[11px] font-semibold text-white/90">
                          {index + 1}
                        </span>
                        <span className="max-w-[200px] truncate font-medium text-white" title={camera.name}>
                          {camera.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
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
                        <img
                          key={`${streamKey}-${camId}`}
                          src={streamUrl}
                          alt={camera.name}
                          className="size-full object-contain"
                          onError={() => {
                            setStreamErrors((prev) => ({ ...prev, [camId]: true }));
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
                                setStreamKey((k) => k + 1);
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
                  </div>
                );
              })}
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
                  variant="stop"
                  className="h-8! w-auto! px-3! text-xs!"
                  disabled={busy || !status?.session_id}
                  onClick={() => action("stop")}
                >
                  <Square size={13} className="mr-1" />
                  Selesai
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel>
            <h2>Informasi Event</h2>
            {row(
              "Tanggal Event",
              currentEvent?.event_date || currentEvent?.created_at
                ? new Date(
                    currentEvent.event_date || currentEvent.created_at || "",
                  ).toLocaleDateString("id-ID", {
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
            {row("Pengunjung unik", value(status?.unique_visitor_count))}
            {row(
              "Visitor Terakhir",
              status?.last_visitor_at
                ? new Date(status.last_visitor_at).toLocaleString("id-ID", {
                    timeZone: status.timezone || "Asia/Jakarta",
                  })
                : "Belum ada aktivitas",
            )}
            {row("Session ID", status?.session_id || "-")}
          </Panel>
        </div>

        <div className="grid gap-6">
          <Panel>
            <h2>Statistik Pengunjung</h2>
            {row("Total Masuk", value(status?.in_count))}
            {row("Total Keluar", value(status?.out_count))}
            {row("Di dalam Area", value(inside))}
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
        <HourlyVisitorStatistics
          companyId={getCompanyId()}
          eventId={selectedEventId}
        />
      </div>
    </Page>
  );
}
