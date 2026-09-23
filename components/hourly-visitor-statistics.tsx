"use client";
import { useEffect, useId, useState } from "react";
import {
  ClockArrowUp,
  RefreshCw,
  Users,
  Plus,
  Mars,
  Venus,
} from "lucide-react";
import Link from "next/link";
const API_BASE =
  (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") +
  "/api/v1/event_visitor";
export type Hour = { hour: number; label: string; in_count: number };
export type Statistics = {
  date: string;
  timezone: string;
  total_in: number;
  male_count: number;
  female_count: number;
  unknown_gender_count: number;
  peak_hour: Hour | null;
  hours: Hour[];
};
type EventOption = { id: string; name: string };
export function todayWib() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function resolveCompanyId(companyId: string) {
  if (companyId) return companyId;
  if (typeof window === "undefined") return "";
  try {
    const user = JSON.parse(localStorage.getItem("user_info") || "null");
    return (
      (user?.account_type === "personal" ? user?.id : user?.company_id) ||
      localStorage.getItem("cctv_company_id") ||
      ""
    );
  } catch {
    return "";
  }
}
export function VisitorChart({
  hours,
  date,
  timezone = "Asia/Jakarta",
  table = true,
}: {
  hours: Hour[];
  date: string;
  timezone?: string;
  table?: boolean;
}) {
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const largest = Math.max(1, ...hours.map((hour) => hour.in_count));
  const unit = 10 ** Math.floor(Math.log10(largest / 5));
  const step = Math.max(1, Math.ceil(largest / 5 / unit) * unit);
  const maximum = step * 5;
  const points = hours.map((hour, index) => ({
    x: 44 + (index / Math.max(1, hours.length - 1)) * 996,
    y: 302 - (hour.in_count / maximum) * 280,
    hour,
  }));
  // Horizontal controls keep the curve within each pair of measured counts.
  const curve = points
    .map((point, i) =>
      i === 0
        ? `M${point.x},${point.y}`
        : `C${(points[i - 1].x + point.x) / 2},${points[i - 1].y} ${(points[i - 1].x + point.x) / 2},${point.y} ${point.x},${point.y}`,
    )
    .join(" ");
  const selected = hours.find((hour) => hour.hour === selectedHour);
  return (
    <div className="chart-panel">
      <div className="chart-scroll">
        <svg
          viewBox="0 0 1065 340"
          preserveAspectRatio="none"
          className="visitor-chart"
          role="group"
          aria-label="Grafik pengunjung masuk per jam"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <g key={i}>
              <line
                x1="44"
                y1={302 - i * 56}
                x2="1040"
                y2={302 - i * 56}
                stroke="#c9c9c9"
                strokeDasharray="2 2"
              />
              <text
                x="38"
                y={306 - i * 56}
                textAnchor="end"
                fill="#555"
                fontSize="12"
              >
                {(maximum / 5) * i}
              </text>
            </g>
          ))}
          {points.map((point, i) => (
            <g key={point.hour.hour}>
              <line
                x1={point.x}
                y1="22"
                x2={point.x}
                y2="302"
                stroke="#c9c9c9"
                strokeDasharray="2 2"
              />
              {(hours.length <= 12 || i % 2 === 0) && (
                <text
                  x={point.x}
                  y="325"
                  textAnchor="middle"
                  fontSize="12"
                  fill="#555"
                >
                  {point.hour.label}
                </text>
              )}
            </g>
          ))}
          <path d={curve} fill="none" stroke="#0c2e73" strokeWidth="1.2" />
          {points.map((point) => (
            <g
              key={point.hour.hour}
              role="button"
              tabIndex={0}
              aria-label={`${point.hour.label}: ${point.hour.in_count} orang masuk`}
              onClick={() => setSelectedHour(point.hour.hour)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedHour(point.hour.hour);
                }
              }}
            >
              <circle cx={point.x} cy={point.y} r="15" fill="transparent" />
              <circle cx={point.x} cy={point.y} r="7" fill="#c4cfe4" />
              <circle
                cx={point.x}
                cy={point.y}
                r="3"
                fill="#0c2e73"
                stroke="white"
              />
              <title>
                {point.hour.label}: {point.hour.in_count} orang masuk
              </title>
            </g>
          ))}
        </svg>
      </div>
      <p className="chart-legend" aria-live="polite">
        <span />
        {selected
          ? `${selected.label}: ${selected.in_count.toLocaleString("id-ID")} orang masuk`
          : date}
      </p>
      {table && (
        <>
          <h3>Rincian Per Jam</h3>
          <div
            className="hour-table-scroll"
            role="region"
            aria-label="Rincian pengunjung per jam"
            tabIndex={0}
          >
            <table className="hour-table">
              <thead>
                <tr>
                  <th scope="col">Jam ({timezone})</th>
                  <th scope="col">Orang masuk</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => (
                  <tr key={hour.hour}>
                    <td>
                      {hour.label}–{String(hour.hour).padStart(2, "0")}:59
                    </td>
                    <td>{hour.in_count.toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
export default function HourlyVisitorStatistics({
  companyId = "",
  eventId = "",
}: {
  companyId?: string;
  eventId?: string;
}) {
  const id = useId();
  const [date, setDate] = useState(todayWib);
  const [data, setData] = useState<{ key: string; value: Statistics } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [availableEvents, setAvailableEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const effectiveCompanyId = resolveCompanyId(companyId);
  const activeEventId = eventId || selectedEventId;
  const key = `${effectiveCompanyId}:${activeEventId}:${date}`;
  useEffect(() => {
    if (!effectiveCompanyId || eventId) return;
    const controller = new AbortController();
    fetch(
      `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/events?company_id=${encodeURIComponent(effectiveCompanyId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then((r) => r.json())
      .then((payload) =>
        setAvailableEvents(Array.isArray(payload.result) ? payload.result : []),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [effectiveCompanyId, eventId]);
  useEffect(() => {
    if (!date || !effectiveCompanyId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      setLoading(true);
      try {
        const eventQuery = activeEventId
          ? `&event_id=${encodeURIComponent(activeEventId)}`
          : "";
        const response = await fetch(
          `${API_BASE}/statistics/hourly?date=${encodeURIComponent(date)}&company_id=${encodeURIComponent(effectiveCompanyId)}${eventQuery}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok)
          throw new Error("Statistik belum dapat dimuat. Coba lagi.");
        const payload = await response.json();
        if (
          !payload.result ||
          payload.result.date !== date ||
          !Array.isArray(payload.result.hours)
        )
          throw new Error("Data statistik tidak valid.");
        if (!controller.signal.aborted) {
          setData({ key, value: payload.result });
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Tidak dapat memuat statistik.",
          );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (date === todayWib()) timer = setTimeout(load, 30000);
        }
      }
    }
    timer = setTimeout(load, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [date, effectiveCompanyId, activeEventId, key, refresh]);
  const current = data?.key === key ? data.value : null;
  const filters = (suffix: string) => (
    <div className="toolbar">
      <button
        type="button"
        className="btn icon-btn"
        aria-label={`Muat ulang ${suffix === "top" ? "statistik" : "distribusi"}`}
        disabled={loading && !!effectiveCompanyId}
        onClick={() => setRefresh((value) => value + 1)}
      >
        <RefreshCw
          size={17}
          className={loading && effectiveCompanyId ? "animate-spin" : ""}
        />
      </button>
      {!eventId && (
        <label className="field">
          Event
          <select
            className="input"
            aria-label={`Filter event ${suffix}`}
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">Semua event</option>
            {availableEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        Tanggal
        <input
          className="input"
          type="date"
          required
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
      </label>
      {suffix === "top" && !eventId && (
        <Link className="btn btn-primary" href="/events?create=1">
          <Plus size={16} />
          Buat Event
        </Link>
      )}
    </div>
  );
  const metrics = [
    {
      label: "Total pengunjung masuk",
      value: current?.total_in.toLocaleString("id-ID") ?? "-",
      icon: Users,
    },
    {
      label: "Jam paling ramai",
      value: current?.peak_hour?.label ?? "-",
      icon: ClockArrowUp,
    },
    {
      label: "Laki-laki",
      value: current?.male_count.toLocaleString("id-ID") ?? "-",
      icon: Mars,
    },
    {
      label: "Perempuan",
      value: current?.female_count.toLocaleString("id-ID") ?? "-",
      icon: Venus,
    },
  ];
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="page-heading">
        <div>
          {!eventId && <p className="eyebrow">OVERVIEW</p>}
          <h2 id={`${id}-title`}>
            {eventId ? "Statistik Pengunjung" : "Pengunjung Masuk per Jam"}
          </h2>
          <p className="page-description">
            {eventId
              ? "Terhitung selama event berlangsung pada tanggal pilihan."
              : "Jumlah event masuk yang tercatat pada tanggal pilihan."}
          </p>
        </div>
        {!eventId && filters("top")}
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error} {current && "Menampilkan data terakhir."}{" "}
          <button
            onClick={() => setRefresh((value) => value + 1)}
            className="underline"
          >
            Coba lagi
          </button>
        </p>
      )}
      <div className="stat-grid">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <Icon />
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h2>Distribusi Pengunjung</h2>
          <p className="page-description">
            Lihat jumlah pengunjung yang masuk setiap jamnya.
          </p>
        </div>
        {filters("chart")}
      </div>
      <div aria-busy={loading && !!effectiveCompanyId}>
        {current ? (
          <>
            {current.total_in === 0 && (
              <p className="panel-description mb-3">
                Belum ada pengunjung masuk pada tanggal ini.
              </p>
            )}
            <VisitorChart
              hours={current.hours}
              date={date}
              timezone={current.timezone}
            />
          </>
        ) : (
          <div role="status" className="chart-panel empty-state">
            {!effectiveCompanyId
              ? "Workspace belum tersedia. Lengkapi pengaturan akun Anda."
              : error
                ? "Statistik tidak tersedia."
                : "Memuat statistik pengunjung…"}
          </div>
        )}
      </div>
    </section>
  );
}
