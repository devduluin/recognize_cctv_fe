"use client";
import { visitorFetch } from "./auth/visitor-api";
import { getAuthHeaders } from "./auth/auth-api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flame, RefreshCw, Repeat, Users } from "lucide-react";
import { Button } from "./ui/button";
import { Field, Select } from "./ui/field";
import { Panel } from "./ui/layout";
import { ui } from "./ui/styles";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SERVICE = process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "";
const VISITOR_API = `${SERVICE}/api/v1/event_visitor`;
const EVENTS_API = `${SERVICE}/api/v1/events`;

type DailyVisit = { date: string; visitors: number; new: number; returning: number };
type CameraHeatmap = {
  camera_key: string;
  camera_name: string | null;
  grid_width: number;
  grid_height: number;
  dwell_seconds: number[];
  flow_x: number[];
  flow_y: number[];
  total_seconds: number;
  has_snapshot: boolean;
};

type CameraOccupancy = {
  camera_key: string;
  camera_name: string | null;
  peak_count: number;
  peak_at: string;
  average_count: number;
  minutes_observed: number;
  hourly: { hour_start: string; peak_count: number; average_count: number }[];
};

// Backend timestamps already carry the workspace offset; show that wall-clock time as is.
function localStamp(value: string, withDate = true) {
  const [day, time] = value.slice(0, 16).split("T");
  return withDate ? `${dayLabel(day)} ${time}` : time;
}

function durationLabel(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} jam ${minutes % 60} menit` : `${minutes} menit`;
}

function dayLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

async function loadJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await visitorFetch(url, { signal, cache: "no-store", headers: getAuthHeaders() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Data belum dapat dimuat.");
  return payload.result as T;
}

// Jet-like ramp matching the report image: transparent blue for little time, red for most.
function heatColor(value: number) {
  const stops = [[0, 0, 255], [0, 255, 255], [255, 255, 0], [255, 0, 0]];
  const position = Math.min(stops.length - 1.001, value * (stops.length - 1));
  const index = Math.floor(position);
  const mix = position - index;
  const [a, b] = [stops[index], stops[index + 1]];
  return `rgba(${a.map((channel, i) => Math.round(channel + (b[i] - channel) * mix)).join(",")},${0.15 + value * 0.5})`;
}

function HeatmapCanvas({ camera, background }: { camera: CameraHeatmap; background: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const { width, height } = element.getBoundingClientRect();
    element.width = Math.round(width * devicePixelRatio);
    element.height = Math.round(height * devicePixelRatio);
    context.scale(devicePixelRatio, devicePixelRatio);
    context.clearRect(0, 0, width, height);
    const { grid_width: columns, grid_height: rows, dwell_seconds: dwell, flow_x: flowX, flow_y: flowY } = camera;
    const peak = Math.max(...dwell, 0);
    if (peak <= 0) return;
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    context.filter = `blur(${Math.max(cellWidth, cellHeight) / 2}px)`;
    dwell.forEach((seconds, index) => {
      if (seconds <= 0) return;
      context.fillStyle = heatColor(Math.sqrt(seconds / peak));
      context.fillRect((index % columns) * cellWidth, Math.floor(index / columns) * cellHeight, cellWidth, cellHeight);
    });
    context.filter = "none";
    const magnitudes = flowX.map((x, index) => Math.hypot(x, flowY[index]));
    const moving = magnitudes.filter((value) => value > 0).sort((left, right) => left - right);
    const threshold = moving.length ? moving[Math.floor(moving.length / 2)] : Infinity;
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 1.5;
    magnitudes.forEach((magnitude, index) => {
      if (magnitude < threshold || magnitude <= 0) return;
      const dx = flowX[index] / magnitude;
      const dy = flowY[index] / magnitude;
      const length = Math.min(cellWidth, cellHeight) * 0.9;
      const cx = ((index % columns) + 0.5) * cellWidth;
      const cy = (Math.floor(index / columns) + 0.5) * cellHeight;
      const [x1, y1, x2, y2] = [cx - (dx * length) / 2, cy - (dy * length) / 2, cx + (dx * length) / 2, cy + (dy * length) / 2];
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      const angle = Math.atan2(dy, dx);
      context.lineTo(x2 - 4 * Math.cos(angle - 0.5), y2 - 4 * Math.sin(angle - 0.5));
      context.moveTo(x2, y2);
      context.lineTo(x2 - 4 * Math.cos(angle + 0.5), y2 - 4 * Math.sin(angle + 0.5));
      context.stroke();
    });
  }, [camera]);
  return (
    <div className="relative overflow-hidden rounded-lg bg-[#202020]" style={{ aspectRatio: `${camera.grid_width} / ${camera.grid_height}` }}>
      {background && <img src={background} alt="" className="absolute inset-0 size-full object-cover" />}
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden="true" />
    </div>
  );
}

export default function EventVisitorInsights({ companyId, eventId }: { companyId: string; eventId: string }) {
  const [days, setDays] = useState<DailyVisit[]>([]);
  const [date, setDate] = useState("");
  const [cameras, setCameras] = useState<CameraHeatmap[]>([]);
  const [cameraKey, setCameraKey] = useState("");
  const [background, setBackground] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [crowd, setCrowd] = useState<CameraOccupancy[]>([]);
  const [crowdKey, setCrowdKey] = useState("");

  useEffect(() => {
    if (!companyId || !eventId) return;
    const controller = new AbortController();
    loadJson<DailyVisit[]>(`${VISITOR_API}/statistics/daily?company_id=${encodeURIComponent(companyId)}&event_id=${encodeURIComponent(eventId)}`, controller.signal)
      .then((result) => setDays(Array.isArray(result) ? result : []))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [companyId, eventId, refresh]);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    setLoading(true);
    loadJson<{ cameras: CameraHeatmap[] }>(`${EVENTS_API}/${encodeURIComponent(eventId)}/heatmap${query}`, controller.signal)
      .then((result) => {
        const list = Array.isArray(result?.cameras) ? result.cameras : [];
        setCameras(list);
        setCameraKey((current) => (list.some((camera) => camera.camera_key === current) ? current : list[0]?.camera_key || ""));
        setError("");
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, date, refresh]);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    loadJson<{ cameras: CameraOccupancy[] }>(`${EVENTS_API}/${encodeURIComponent(eventId)}/occupancy`, controller.signal)
      .then((result) => {
        const list = Array.isArray(result?.cameras) ? result.cameras : [];
        setCrowd(list);
        setCrowdKey((current) => (list.some((item) => item.camera_key === current) ? current : list[0]?.camera_key || ""));
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [eventId, refresh]);

  const crowdCamera = crowd.find((item) => item.camera_key === crowdKey);
  const crowdDays = new Set(crowdCamera?.hourly.map((hour) => hour.hour_start.slice(0, 10))).size;

  const camera = useMemo(() => cameras.find((item) => item.camera_key === cameraKey), [cameras, cameraKey]);

  useEffect(() => {
    if (!camera?.has_snapshot) return;
    const controller = new AbortController();
    let url = "";
    visitorFetch(`${EVENTS_API}/${encodeURIComponent(eventId)}/heatmap/snapshot?camera_key=${encodeURIComponent(camera.camera_key)}`,
      { signal: controller.signal, cache: "no-store", headers: getAuthHeaders() })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => { if (blob && !controller.signal.aborted) { url = URL.createObjectURL(blob); setBackground(url); } })
      .catch(() => {});
    return () => {
      controller.abort();
      setBackground("");
      if (url) URL.revokeObjectURL(url);
    };
  }, [eventId, camera?.camera_key, camera?.has_snapshot]);

  const totals = days.reduce((sum, day) => ({ new: sum.new + day.new, returning: sum.returning + day.returning }), { new: 0, returning: 0 });

  return (
    <div className="grid gap-4 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {error && <p role="alert" className={`${ui.error} min-[1200px]:col-span-2`}>{error}</p>}
      <Panel>
        <div className={ui.panelHeading}>
          <div>
            <h2 className="flex items-center gap-2"><Repeat size={18} /> Pengunjung Baru vs Kembali</h2>
            <p className={ui.panelDescription}>Pengunjung yang datang lagi pada hari berbeda dalam event ini.</p>
          </div>
          <Button icon aria-label="Muat ulang" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
        {days.length ? (
          <>
            <p className="mb-3 text-sm text-muted">
              Total kunjungan ulang: <strong className="text-[#383838]">{totals.returning}</strong> dari {totals.new + totals.returning} kunjungan harian.
            </p>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days.map((day) => ({ ...day, label: dayLabel(day.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="new" name="Baru" stackId="visits" fill="#4f46e5" />
                  <Bar dataKey="returning" name="Kembali" stackId="visits" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className={ui.emptyState}>Belum ada kunjungan tercatat.</p>
        )}
      </Panel>
      <Panel>
        <div className={ui.panelHeading}>
          <div>
            <h2 className="flex items-center gap-2"><Flame size={18} /> Heatmap Pengunjung</h2>
            <p className={ui.panelDescription}>Warna menunjukkan lama kehadiran; panah menunjukkan arah gerak dominan.</p>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2 [&_select]:min-w-[160px]">
          <Field label="Kamera">
            <Select value={cameraKey} onChange={(event) => setCameraKey(event.target.value)} disabled={!cameras.length}>
              {cameras.map((item) => <option key={item.camera_key} value={item.camera_key}>{item.camera_name || "Kamera"}</option>)}
            </Select>
          </Field>
          <Field label="Hari">
            <Select value={date} onChange={(event) => setDate(event.target.value)}>
              <option value="">Seluruh event</option>
              {days.map((day) => <option key={day.date} value={day.date}>{dayLabel(day.date)}</option>)}
            </Select>
          </Field>
        </div>
        {camera ? (
          <>
            <HeatmapCanvas camera={camera} background={background} />
            <p className="mt-2 text-xs text-muted">
              Total kehadiran terekam: {durationLabel(camera.total_seconds)}
              {!camera.has_snapshot && " · tanpa gambar latar (penyimpanan foto nonaktif atau belum ada snapshot)"}
            </p>
          </>
        ) : (
          <p className={ui.emptyState}>{loading ? "Memuat heatmap…" : "Belum ada data heatmap untuk pilihan ini."}</p>
        )}
      </Panel>
      {crowdCamera && (
        <Panel className="min-[1200px]:col-span-2">
          <div className={ui.panelHeading}>
            <div>
              <h2 className="flex items-center gap-2"><Users size={18} /> Riwayat Keramaian</h2>
              <p className={ui.panelDescription}>Jumlah orang yang terlihat di zona keramaian, disimpan setiap menit dari kamera dan video.</p>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2 [&_select]:min-w-[160px]">
            <Field label="Kamera">
              <Select value={crowdKey} onChange={(event) => setCrowdKey(event.target.value)}>
                {crowd.map((item) => <option key={item.camera_key} value={item.camera_key}>{item.camera_name || "Kamera"}</option>)}
              </Select>
            </Field>
          </div>
          <dl className="mb-4 grid gap-3 sm:grid-cols-3">
            {[["Puncak", `${crowdCamera.peak_count} orang`, localStamp(crowdCamera.peak_at)],
              ["Rata-rata", `${crowdCamera.average_count} orang`, "dari semua frame yang diperiksa"],
              ["Durasi terekam", durationLabel(crowdCamera.minutes_observed * 60), `${crowdCamera.hourly.length} jam berisi data`]].map(([label, value, note]) => (
              <div key={label} className="rounded-lg border border-line p-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold">{value}</dd>
                <dd className="text-xs text-muted">{note}</dd>
              </div>
            ))}
          </dl>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={crowdCamera.hourly.map((hour) => ({ ...hour, label: localStamp(hour.hour_start, crowdDays > 1) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="peak_count" name="Puncak" fill="#4f46e5" />
                <Line dataKey="average_count" name="Rata-rata" stroke="#10b981" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}
    </div>
  );
}
