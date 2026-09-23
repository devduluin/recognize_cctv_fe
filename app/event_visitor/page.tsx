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
  const [streamError, setStreamError] = useState(false);
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
      setStreamError(false);
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
  const inside = Math.max(
    0,
    (status?.in_count || 0) - (status?.out_count || 0),
  );
  const value = (count?: number) =>
    status ? `${(count || 0).toLocaleString("id-ID")} Orang` : "-";
  const demographics = [
    { label: "Laki-laki", count: status?.male_count || 0 },
    { label: "Perempuan", count: status?.female_count || 0 },
    {
      label: "Belum Teridentifikasi",
      count: status?.unknown_gender_count || 0,
    },
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
        <Panel className="p-0!">
          <h2 className="px-4 pt-3">Live Camera</h2>
          <div ref={stage} className="group/camera relative overflow-hidden rounded-xl bg-[#edf1f7] [&:fullscreen]:flex [&:fullscreen]:items-center [&:fullscreen]:rounded-none [&:fullscreen]:bg-[#101c30]">
            <div className="grid aspect-video w-full place-items-center group-[:fullscreen]/camera:aspect-auto group-[:fullscreen]/camera:h-full [&_img]:size-full [&_img]:object-contain">
              {running && !connectionError && !streamError ? (
                <img
                  key={streamKey}
                  src={`${API_BASE}/stream?company_id=${encodeURIComponent(getCompanyId())}&event_id=${encodeURIComponent(selectedEventId)}`}
                  alt="Live kamera event"
                  onError={() => setStreamError(true)}
                />
              ) : (
                <div className={ui.emptyState}>
                  <Video size={36} className="mx-auto mb-3 text-[#0c2e73]" />
                  <p>
                    {streamError
                      ? "Preview belum tersedia"
                      : connectionError
                        ? "Koneksi kamera terputus"
                        : "Monitoring belum berjalan"}
                  </p>
                  {streamError && (
                    <Button
                      className="mt-3"
                      onClick={() => {
                        setStreamError(false);
                        setStreamKey((key) => key + 1);
                      }}
                    >
                      <RefreshCw size={15} />
                      Muat ulang video
                    </Button>
                  )}
                </div>
              )}
              <span className="absolute left-4 top-4 rounded bg-white/90 px-2 py-1 text-[10px] text-slate-700">
                {running && !streamError && !connectionError
                  ? "LIVE"
                  : "STAND BY"}
              </span>
              <Button
                className="absolute top-4 right-4 min-h-6! rounded! px-2! py-1! text-xs!"
                onClick={async () => {
                  try {
                    if (document.fullscreenElement)
                      await document.exitFullscreen();
                    else await stage.current?.requestFullscreen();
                  } catch {
                    setActionError(
                      "Layar penuh tidak tersedia di browser ini.",
                    );
                  }
                }}
              >
                <Maximize size={14} />
                Full Screen
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 bg-[#f4f6f9] px-[18px] py-3 group-[:fullscreen]/camera:absolute group-[:fullscreen]/camera:inset-x-5 group-[:fullscreen]/camera:bottom-5 group-[:fullscreen]/camera:bg-transparent [&_button]:px-2">
              <Button
                variant="play"
                disabled={
                  busy ||
                  running ||
                  !status ||
                  status.camera_source == null ||
                  Boolean(connectionError)
                }
                onClick={() => action("start")}
              >
                <Play size={15} />
                Play
              </Button>
              <Button
                variant="pause"
                disabled={busy || !running}
                onClick={() => action("pause")}
              >
                <Pause size={15} />
                Pause
              </Button>
              <Button
                variant="stop"
                disabled={busy || !status?.session_id}
                onClick={() => action("stop")}
              >
                <Square size={15} />
                Stop
              </Button>
            </div>
          </div>
        </Panel>
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
      <div className="pt-2">
        <HourlyVisitorStatistics
          companyId={getCompanyId()}
          eventId={selectedEventId}
        />
      </div>
    </Page>
  );
}
