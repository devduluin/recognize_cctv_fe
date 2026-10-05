"use client";
import { visitorFetch } from "./auth/visitor-api";
import { useEffect, useId, useMemo, useState } from "react";
import {
  ClockArrowUp,
  RefreshCw,
  Users,
  Plus,
  Mars,
  Venus,
  HelpCircle,
  BarChart3,
  Activity,
  LayoutGrid,
} from "lucide-react";
import { Button, ButtonLink } from "./ui/button";
import { Field, Input, Select } from "./ui/field";
import { PageHeading, ScrollArea, Toolbar } from "./ui/layout";
import { StatCard } from "./ui/stat-card";
import { cx, ui } from "./ui/styles";
import { getAuthHeaders } from "./auth/auth-api";
import DashboardCameraPreview from "./dashboard-camera-preview";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  Legend as RechartsLegend,
} from "recharts";
const API_BASE =
  (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") +
  "/api/v1/event_visitor";
export type Hour = {
  hour: number;
  label: string;
  in_count: number;
  male_count?: number;
  female_count?: number;
  unknown_count?: number;
};
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
interface HourlyTooltipPayloadItem {
  payload: Hour;
  value: number;
}

function CustomHourlyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-lg backdrop-blur-md">
        <p className="text-xs font-semibold text-slate-800">
          Pukul {data.label} – {String(data.hour).padStart(2, "0")}:59
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#0c2e73]" />
          <span className="text-xs text-slate-600">Pengunjung Masuk:</span>
          <span className="text-xs font-bold text-slate-900">
            {data.in_count.toLocaleString("id-ID")} Orang
          </span>
        </div>
      </div>
    );
  }
  return null;
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={ui.chartPanel}>
      <div className="p-5">
        <div className="h-[340px] w-full min-h-[340px]">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
              <AreaChart
                data={hours}
                margin={{ top: 20, right: 25, left: -10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="hourlyAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0c2e73" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0c2e73" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  interval={hours.length > 12 ? 1 : 0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  allowDecimals={false}
                />
                <RechartsTooltip content={CustomHourlyTooltip} />
                <Area
                  type="monotone"
                  dataKey="in_count"
                  stroke="#0c2e73"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#hourlyAreaGradient)"
                  activeDot={{ r: 6, stroke: "#0c2e73", strokeWidth: 2, fill: "#ffffff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              Memuat grafik...
            </div>
          )}
        </div>
      </div>
      <p className="flex items-center justify-center gap-1.5 pb-5 text-xs/normal text-[#555]" aria-live="polite">
        <span className="mr-1 size-2 rounded-full bg-[#0c2e73]" />
        Grafik Tren Pengunjung Masuk ({date})
      </p>
      {table && (
        <>
          <h3>Rincian Per Jam</h3>
          <ScrollArea
            className="max-h-[360px]"
            aria-label="Rincian pengunjung per jam"
          >
            <table className="w-full text-left text-sm/normal [&_th]:sticky [&_th]:top-0 [&_th]:z-1 [&_th]:bg-[#f4f6f9] [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-muted [&_td]:border-b [&_td]:border-[#f0f3f8] [&_td]:px-5 [&_td]:py-[9px] [&_th:last-child]:text-right [&_td:last-child]:text-right">
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
          </ScrollArea>
        </>
      )}
    </div>
  );
}

interface GenderChartItem {
  name: string;
  shortName: string;
  count: number;
  percentage: string;
  fill: string;
  lightBg: string;
  icon: typeof Mars;
}

interface GenderTooltipPayloadItem {
  payload: GenderChartItem;
}

function CustomGenderTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: GenderTooltipPayloadItem[];
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: data.fill }}
          />
          <p className="text-xs font-semibold text-slate-900">{data.name}</p>
        </div>
        <div className="mt-2 space-y-1">
          <p className="text-xs text-slate-600">
            Jumlah: <span className="font-bold text-slate-900">{data.count.toLocaleString("id-ID")} Orang</span>
          </p>
          <p className="text-xs text-slate-600">
            Proporsi: <span className="font-bold text-slate-900">{data.percentage}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
}

export function GenderBarChart({
  hours,
  maleCount = 0,
  femaleCount = 0,
  unknownCount = 0,
  total = 0,
  date,
  timezone = "Asia/Jakarta",
  table = true,
}: {
  hours?: Hour[];
  maleCount: number;
  femaleCount: number;
  unknownCount: number;
  total: number;
  date?: string;
  timezone?: string;
  table?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"hourly" | "summary">(
    hours && hours.length > 0 ? "hourly" : "summary",
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatedTotal = total > 0 ? total : maleCount + femaleCount + unknownCount;
  const safeTotal = Math.max(1, calculatedTotal);
  const malePct = Math.round((maleCount / safeTotal) * 100);
  const femalePct = Math.round((femaleCount / safeTotal) * 100);
  const unknownPct = Math.max(0, 100 - malePct - femalePct);

  const summaryData: GenderChartItem[] = [
    {
      name: "Pria (Laki-laki)",
      shortName: "Pria",
      count: maleCount,
      percentage: `${malePct}%`,
      fill: "#2563eb",
      lightBg: "bg-blue-50 text-blue-700 border-blue-200",
      icon: Mars,
    },
    {
      name: "Perempuan (Wanita)",
      shortName: "Wanita",
      count: femaleCount,
      percentage: `${femalePct}%`,
      fill: "#ec4899",
      lightBg: "bg-pink-50 text-pink-700 border-pink-200",
      icon: Venus,
    },
    {
      name: "Unknown (Tidak Diketahui)",
      shortName: "Unknown",
      count: unknownCount,
      percentage: `${unknownPct}%`,
      fill: "#64748b",
      lightBg: "bg-slate-100 text-slate-700 border-slate-200",
      icon: HelpCircle,
    },
  ];

  const hourlyData = useMemo(
    () =>
      (hours ?? []).map((h) => ({
        hour: h.hour,
        label: h.label,
        male_count: h.male_count ?? 0,
        female_count: h.female_count ?? 0,
        unknown_count: h.unknown_count ?? 0,
        in_count: h.in_count,
      })),
    [hours],
  );

  return (
    <div className={ui.chartPanel}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span className="text-xs font-semibold text-slate-700">
          {viewMode === "hourly"
            ? "Distribusi Gender Tiap Jam (24 Jam)"
            : "Total Perbandingan Demografi"}
        </span>
        {hours && hours.length > 0 && (
          <div className="flex items-center rounded-md bg-slate-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode("hourly")}
              className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
                viewMode === "hourly"
                  ? "bg-white font-semibold text-navy shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Per Jam
            </button>
            <button
              type="button"
              onClick={() => setViewMode("summary")}
              className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
                viewMode === "summary"
                  ? "bg-white font-semibold text-navy shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Total Hari
            </button>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="h-[340px] w-full min-h-[340px]">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
              {viewMode === "hourly" ? (
                <BarChart
                  data={hourlyData}
                  margin={{ top: 25, right: 25, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    interval={hourlyData.length > 12 ? 1 : 0}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={CustomCombinedTooltip} />
                  <RechartsLegend
                    wrapperStyle={{ paddingTop: 10 }}
                    formatter={(value) => (
                      <span className="text-xs font-medium text-slate-700">{value}</span>
                    )}
                  />
                  <Bar
                    dataKey="male_count"
                    name="Pria"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    dataKey="female_count"
                    name="Wanita"
                    fill="#ec4899"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    dataKey="unknown_count"
                    name="Unknown"
                    fill="#64748b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              ) : (
                <BarChart
                  data={summaryData}
                  margin={{ top: 25, right: 25, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tick={{ fill: "#475569", fontSize: 13, fontWeight: 500 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<CustomGenderTooltip />} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={90}>
                    {summaryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              Memuat grafik...
            </div>
          )}
        </div>
      </div>

      {/* Legend & Summary Cards */}
      <div className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50/50 p-4 min-[600px]:grid-cols-3">
        {summaryData.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.shortName}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <span className={`flex size-8 items-center justify-center rounded-lg border ${cat.lightBg}`}>
                  <Icon size={16} />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500">{cat.name}</p>
                  <p className="text-sm font-bold text-slate-900">
                    {cat.count.toLocaleString("id-ID")}{" "}
                    <span className="text-xs font-normal text-slate-500">orang</span>
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                {cat.percentage}
              </span>
            </div>
          );
        })}
      </div>

      {table && (
        <>
          <h3>Rincian Demografi Pengunjung</h3>
          <ScrollArea
            className="max-h-[360px]"
            aria-label="Rincian demografi pengunjung"
          >
            <table className="w-full text-left text-sm/normal [&_th]:sticky [&_th]:top-0 [&_th]:z-1 [&_th]:bg-[#f4f6f9] [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-muted [&_td]:border-b [&_td]:border-[#f0f3f8] [&_td]:px-5 [&_td]:py-[12px] [&_th:last-child]:text-right [&_td:last-child]:text-right">
              <thead>
                <tr>
                  <th scope="col">Kategori Pengunjung</th>
                  <th scope="col">Persentase</th>
                  <th scope="col">Jumlah Masuk</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map((cat) => (
                  <tr key={cat.shortName}>
                    <td className="font-medium text-slate-800">
                      <span
                        className="mr-2 inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: cat.fill }}
                      />
                      {cat.name}
                    </td>
                    <td>{cat.percentage}</td>
                    <td>{cat.count.toLocaleString("id-ID")} Orang</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/80 font-semibold text-slate-900">
                  <td>Total Tercatat</td>
                  <td>100%</td>
                  <td>{calculatedTotal.toLocaleString("id-ID")} Orang</td>
                </tr>
              </tbody>
            </table>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

interface CombinedTooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  payload: {
    hour: number;
    label: string;
    in_count: number;
    male_count: number;
    female_count: number;
    unknown_count: number;
  };
}

function CustomCombinedTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="min-w-[210px] rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
        <p className="mb-2 border-b border-slate-100 pb-1.5 text-xs font-bold text-slate-900">
          Pukul {data.label} – {String(data.hour).padStart(2, "0")}:59
        </p>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between font-semibold text-slate-900">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#0c2e73]" />
              Total Masuk
            </span>
            <span>{data.in_count.toLocaleString("id-ID")} Orang</span>
          </div>
          <div className="flex items-center justify-between text-blue-700">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#2563eb]" />
              Pria
            </span>
            <span className="font-semibold">{data.male_count.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex items-center justify-between text-pink-700">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#ec4899]" />
              Wanita
            </span>
            <span className="font-semibold">{data.female_count.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#64748b]" />
              Unknown
            </span>
            <span className="font-semibold">{data.unknown_count.toLocaleString("id-ID")}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function CombinedVisitorChart({
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
  const [mounted, setMounted] = useState(false);
  const [isStacked, setIsStacked] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = useMemo(
    () =>
      (hours ?? []).map((hour) => ({
        hour: hour.hour,
        label: hour.label,
        in_count: hour.in_count,
        male_count: hour.male_count ?? 0,
        female_count: hour.female_count ?? 0,
        unknown_count: hour.unknown_count ?? 0,
      })),
    [hours],
  );

  return (
    <div className={ui.chartPanel}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <span className="text-xs font-semibold text-slate-700">
          Grafik Gabungan Tren (Line) & Distribusi Gender (Bar) Per Jam
        </span>
        <div className="flex items-center rounded-md bg-slate-100 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setIsStacked(true)}
            className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
              isStacked
                ? "bg-white font-semibold text-navy shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Bertumpuk
          </button>
          <button
            type="button"
            onClick={() => setIsStacked(false)}
            className={`rounded px-2.5 py-1 transition-colors cursor-pointer ${
              !isStacked
                ? "bg-white font-semibold text-navy shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Berdampingan
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="h-[360px] w-full min-h-[360px]">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 25, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  interval={hours.length > 12 ? 1 : 0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  allowDecimals={false}
                />
                <RechartsTooltip content={CustomCombinedTooltip} />
                <RechartsLegend
                  wrapperStyle={{ paddingTop: 15 }}
                  formatter={(value) => (
                    <span className="text-xs font-medium text-slate-700">{value}</span>
                  )}
                />
                {/* Gender Bars per hour */}
                <Bar
                  dataKey="male_count"
                  name="Pria (Bar)"
                  stackId={isStacked ? "gender" : undefined}
                  fill="#2563eb"
                  radius={isStacked ? undefined : [3, 3, 0, 0]}
                  maxBarSize={isStacked ? 28 : 12}
                />
                <Bar
                  dataKey="female_count"
                  name="Wanita (Bar)"
                  stackId={isStacked ? "gender" : undefined}
                  fill="#ec4899"
                  radius={isStacked ? undefined : [3, 3, 0, 0]}
                  maxBarSize={isStacked ? 28 : 12}
                />
                <Bar
                  dataKey="unknown_count"
                  name="Unknown (Bar)"
                  stackId={isStacked ? "gender" : undefined}
                  fill="#64748b"
                  radius={isStacked ? [4, 4, 0, 0] : [3, 3, 0, 0]}
                  maxBarSize={isStacked ? 28 : 12}
                />
                {/* Total Line running above the bars */}
                <Line
                  type="monotone"
                  dataKey="in_count"
                  name="Tren Total (Line)"
                  stroke="#0c2e73"
                  strokeWidth={2.8}
                  dot={{ r: 3, fill: "#0c2e73" }}
                  activeDot={{ r: 6, stroke: "#0c2e73", strokeWidth: 2, fill: "#ffffff" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              Memuat grafik gabungan...
            </div>
          )}
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 pb-4 text-xs/normal text-slate-500" aria-live="polite">
        <span className="mr-1 size-2 rounded-full bg-[#0c2e73]" />
        Penggabungan Tren Per Jam (Line) & Distribusi Gender (Bar) ({date})
      </p>

      {table && (
        <>
          <h3>Rincian Pengunjung & Gender Per Jam</h3>
          <ScrollArea
            className="max-h-[360px]"
            aria-label="Rincian pengunjung dan gender per jam"
          >
            <table className="w-full text-left text-sm/normal [&_th]:sticky [&_th]:top-0 [&_th]:z-1 [&_th]:bg-[#f4f6f9] [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-muted [&_td]:border-b [&_td]:border-[#f0f3f8] [&_td]:px-5 [&_td]:py-[10px] [&_th:last-child]:text-right [&_td:last-child]:text-right">
              <thead>
                <tr>
                  <th scope="col">Jam ({timezone})</th>
                  <th scope="col" className="text-blue-700">Pria</th>
                  <th scope="col" className="text-pink-700">Wanita</th>
                  <th scope="col" className="text-slate-600">Unknown</th>
                  <th scope="col">Total Masuk</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.hour}>
                    <td className="font-medium text-slate-800">
                      {row.label}–{String(row.hour).padStart(2, "0")}:59
                    </td>
                    <td className="text-blue-700 font-medium">
                      {row.male_count.toLocaleString("id-ID")}
                    </td>
                    <td className="text-pink-700 font-medium">
                      {row.female_count.toLocaleString("id-ID")}
                    </td>
                    <td className="text-slate-600">
                      {row.unknown_count.toLocaleString("id-ID")}
                    </td>
                    <td className="font-bold text-slate-900">
                      {row.in_count.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
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
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [availableEvents, setAvailableEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const effectiveCompanyId = useMemo(() => resolveCompanyId(companyId), [companyId]);
  const activeEventId = eventId || selectedEventId;
  const key = `${effectiveCompanyId}:${activeEventId}:${date}`;
  useEffect(() => {
    if (!effectiveCompanyId || eventId) return;
    const controller = new AbortController();
    visitorFetch(
      `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/events?company_id=${encodeURIComponent(effectiveCompanyId)}`,
      { cache: "no-store", signal: controller.signal, headers: getAuthHeaders() },
    )
      .then((r) => r.json())
      .then((payload) =>
        setAvailableEvents(Array.isArray(payload.result) ? payload.result : []),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [effectiveCompanyId, eventId]);
  useEffect(() => {
    if (!date || !effectiveCompanyId) {
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      setLoading(true);
      try {
        const eventQuery = activeEventId
          ? `&event_id=${encodeURIComponent(activeEventId)}`
          : "";
        const response = await visitorFetch(
          `${API_BASE}/statistics/hourly?date=${encodeURIComponent(date)}&company_id=${encodeURIComponent(effectiveCompanyId)}${eventQuery}`,
          { signal: controller.signal, cache: "no-store", headers: getAuthHeaders() },
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
    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [date, effectiveCompanyId, activeEventId, key, refresh]);
  const current = data?.key === key ? data.value : null;
  const filters = (suffix: string) => (
    <Toolbar>
      <Button
        type="button"
        icon
        aria-label={`Muat ulang ${suffix === "top" ? "statistik" : "distribusi"}`}
        disabled={loading && !!effectiveCompanyId}
        onClick={() => setRefresh((value) => value + 1)}
      >
        <RefreshCw
          size={17}
          className={loading && effectiveCompanyId ? "animate-spin" : ""}
        />
      </Button>
      {!eventId && (
        <Field>
          Event
          <Select
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
          </Select>
        </Field>
      )}
      <Field>
        Tanggal
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      {suffix === "top" && !eventId && (
        <ButtonLink variant="primary" href="/events?create=1">
          <Plus size={16} />
          Buat Event
        </ButtonLink>
      )}
    </Toolbar>
  );

  const [chartType, setChartType] = useState<"both" | "line" | "bar">("both");

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
    {
      label: "Belum teridentifikasi (Unknown)",
      value: current?.unknown_gender_count?.toLocaleString("id-ID") ?? "-",
      icon: HelpCircle,
    },
  ];
  return (
    <section aria-labelledby={`${id}-title`}>
      <PageHeading>
        <div>
          {!eventId && <p className={ui.eyebrow}>OVERVIEW</p>}
          <h2 id={`${id}-title`}>
            {eventId ? "Statistik Pengunjung" : "Pengunjung Masuk per Jam"}
          </h2>
          <p className={ui.pageDescription}>
            {eventId
              ? "Terhitung selama event berlangsung pada tanggal pilihan."
              : "Jumlah event masuk yang tercatat pada tanggal pilihan."}
          </p>
        </div>
        {!eventId && filters("top")}
      </PageHeading>
      {error && (
        <p role="alert" className={ui.error}>
          {error} {current && "Menampilkan data terakhir."}{" "}
          <button
            onClick={() => setRefresh((value) => value + 1)}
            className="underline"
          >
            Coba lagi
          </button>
        </p>
      )}
      <div className={ui.statGrid}>
        {metrics.map(({ label, value, icon: Icon }) => (
          <StatCard key={label} label={label} value={value} icon={Icon} />
        ))}
      </div>

      {/* Preview CCTV Kamera di Dashboard Overview */}
      {!eventId && <DashboardCameraPreview companyId={effectiveCompanyId} />}

      <div className={ui.sectionHeading}>
        <div>
          <h2>Distribusi Pengunjung</h2>
          <p className={ui.pageDescription}>
            Lihat perbandingan jumlah pengunjung per jam dan demografi gender (pria, wanita, unknown).
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setChartType("both")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
              chartType === "both"
                ? "bg-white font-semibold text-navy shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid size={14} />
            Semua (Tren & Gender)
          </button>
          <button
            type="button"
            onClick={() => setChartType("line")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
              chartType === "line"
                ? "bg-white font-semibold text-navy shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity size={14} />
            Tren per Jam (Line)
          </button>
          <button
            type="button"
            onClick={() => setChartType("bar")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
              chartType === "bar"
                ? "bg-white font-semibold text-navy shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 size={14} />
            Distribusi Gender (Bar)
          </button>
        </div>
      </div>
      <div aria-busy={loading && !!effectiveCompanyId}>
        {current ? (
          <div>
            {current.total_in === 0 && (
              <p className={cx(ui.panelDescription, "mb-3")}>
                Belum ada pengunjung masuk pada tanggal ini.
              </p>
            )}
            {chartType === "both" && (
              <CombinedVisitorChart
                hours={current.hours}
                date={date}
                timezone={current.timezone}
              />
            )}
            {chartType === "line" && (
              <VisitorChart
                hours={current.hours}
                date={date}
                timezone={current.timezone}
              />
            )}
            {chartType === "bar" && (
              <GenderBarChart
                hours={current.hours}
                maleCount={current.male_count}
                femaleCount={current.female_count}
                unknownCount={current.unknown_gender_count}
                total={current.total_in}
                date={date}
                timezone={current.timezone}
              />
            )}
          </div>
        ) : (
          <div role="status" className={cx(ui.chartPanel, ui.emptyState)}>
            {!effectiveCompanyId
              ? "Workspace belum tersedia. Lengkapi pengaturan akun Anda."
              : !date
                ? "Pilih tanggal untuk melihat statistik."
                : error
                  ? "Statistik tidak tersedia."
                  : "Memuat statistik pengunjung…"}
          </div>
        )}
      </div>
    </section>
  );
}
