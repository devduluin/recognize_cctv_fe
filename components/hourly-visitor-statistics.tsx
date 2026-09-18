"use client";

import { useEffect, useState } from "react";
import { BarChart3, Clock3, Loader2, RefreshCw, Users } from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/event_visitor";
type Hour = { hour: number; label: string; in_count: number };
type Statistics = { date: string; timezone: string; total_in: number; male_count: number; female_count: number; unknown_gender_count: number; peak_hour: Hour | null; hours: Hour[] };
type EventOption = { id: string; name: string };

function todayWib() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function resolveCompanyId(companyId: string) {
  if (companyId) return companyId;
  try {
    const user = JSON.parse(localStorage.getItem("user_info") || "null");
    const fromUser = user?.account_type === "personal" ? user?.id : user?.company_id;
    return fromUser || localStorage.getItem("cctv_company_id") || "";
  } catch {
    return "";
  }
}

export default function HourlyVisitorStatistics({ companyId = "", eventId = "" }: { companyId?: string; eventId?: string }) {
  const [date, setDate] = useState(todayWib);
  const [data, setData] = useState<Statistics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selectedHour, setSelectedHour] = useState(8);
  const [availableEvents, setAvailableEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(eventId);
  const effectiveCompanyId = resolveCompanyId(companyId);

  useEffect(() => {
    if (!effectiveCompanyId || eventId) return;
    fetch(`${(process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "")}/api/v1/events?company_id=${encodeURIComponent(effectiveCompanyId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setAvailableEvents(Array.isArray(payload.result) ? payload.result : []))
      .catch(() => setAvailableEvents([]));
  }, [effectiveCompanyId, eventId]);

  useEffect(() => setSelectedEventId(eventId), [eventId]);

  useEffect(() => {
    if (!date || !effectiveCompanyId) {
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      setLoading(true);
      try {
        const activeEventId = eventId || selectedEventId;
        const eventQuery = activeEventId ? `&event_id=${encodeURIComponent(activeEventId)}` : "";
        const response = await fetch(`${API_BASE}/statistics/hourly?date=${encodeURIComponent(date)}&company_id=${encodeURIComponent(effectiveCompanyId)}${eventQuery}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Statistik belum dapat dimuat. Coba lagi.");
        const raw = await response.text();
        let payload: { result?: Statistics; detail?: string } = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch { payload.detail = raw; }
        if (!payload.result || payload.result.date !== date || !Array.isArray(payload.result.hours)) throw new Error("Data statistik tidak valid. Coba muat ulang.");
        if (!controller.signal.aborted) {
          setData(payload.result);
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Tidak dapat memuat statistik.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (date === todayWib()) timer = setTimeout(load, 30000);
        }
      }
    };
    timer = setTimeout(load, 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [date, effectiveCompanyId, eventId, selectedEventId, refresh]);

  const current = data?.date === date ? data : null;
  const maximum = Math.max(1, ...current?.hours.map((hour) => hour.in_count) ?? []);
  const selected = current?.hours.find((hour) => hour.hour === selectedHour);
  const nextLabel = `${String((selectedHour + 1) % 24).padStart(2, "0")}:00`;

  const svgWidth = 850;
  const svgHeight = 192;
  const paddingY = 24;
  
  let curveD = "";
  let fillD = "";
  let points: { x: number; y: number; hour: Hour }[] = [];
  
  if (current) {
    points = current.hours.map((hour, i) => {
      const x = (i / 23) * svgWidth;
      const y = svgHeight - paddingY - (maximum > 0 ? (hour.in_count / maximum) * (svgHeight - paddingY * 2) : 0);
      return { x, y, hour };
    });

    if (points.length > 0) {
      curveD = `M ${points[0].x},${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = i > 0 ? points[i - 1] : points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i !== points.length - 2 ? points[i + 2] : p2;
        
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        
        curveD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }
      fillD = `${curveD} L ${points[points.length-1].x},${svgHeight} L ${points[0].x},${svgHeight} Z`;
    }
  }

  return (
    <section aria-labelledby="hourly-title" className="mt-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 id="hourly-title" className="text-lg font-semibold">Pengunjung Masuk per Jam</h2><p className="mt-1 text-sm text-slate-500">Jumlah event masuk yang tercatat pada tanggal pilihan · {current?.timezone || "zona waktu perusahaan"}.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          {!eventId && <label className="text-xs font-medium text-slate-500"><span className="mb-1.5 block">Event</span><select aria-label="Filter event dashboard" value={selectedEventId} onChange={(event) => { setSelectedEventId(event.target.value); setError(""); }} className="max-w-[190px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Semua event</option>{availableEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>}
          <label className="text-xs font-medium text-slate-500"><span className="mb-1.5 block">Tanggal</span><input type="date" required aria-label="Tanggal statistik pengunjung" value={date} onChange={(event) => { if (event.target.value) { setDate(event.target.value); setError(""); } }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" /></label>
          <button type="button" aria-label="Muat ulang statistik" disabled={loading} onClick={() => setRefresh((value) => value + 1)} className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error} {current ? "Angka yang ditampilkan adalah data terakhir yang berhasil dimuat." : ""}</span><button type="button" className="font-semibold underline disabled:opacity-50" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Coba lagi</button></div>}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total masuk", value: current ? `${current.total_in.toLocaleString("id-ID")} orang` : "—", detail: "Akumulasi pada tanggal pilihan", icon: Users },
          { label: "Jam paling ramai", value: current?.peak_hour ? `${current.peak_hour.label}` : "—", detail: current?.peak_hour ? `${current.peak_hour.in_count.toLocaleString("id-ID")} orang masuk` : "Belum ada pengunjung tercatat", icon: Clock3 },
          { label: "Jam terpilih", value: selected ? `${selected.in_count.toLocaleString("id-ID")} orang` : "—", detail: `${String(selectedHour).padStart(2, "0")}:00–${nextLabel} ${current?.timezone || ""}`, icon: BarChart3 },
        ].map(({ label, value, detail, icon: Icon }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-500"><span>{label}</span><Icon size={18} className="text-indigo-500" /></div><p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Laki-laki", value: current ? current.male_count.toLocaleString("id-ID") : "—", tone: "text-sky-600" },
          { label: "Perempuan", value: current ? current.female_count.toLocaleString("id-ID") : "—", tone: "text-rose-600" },
          { label: "Belum teridentifikasi", value: current ? current.unknown_gender_count.toLocaleString("id-ID") : "—", tone: "text-slate-600" },
        ].map(({ label, value, tone }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className={`mt-3 text-2xl font-semibold tabular-nums ${tone}`}>{value}<span className="ml-1 text-sm font-normal text-slate-400">orang</span></p></div>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4"><span className="text-sm font-medium">Distribusi pengunjung · 00:00–23:59</span><span className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-indigo-500" />Masuk {loading && <Loader2 size={14} className="animate-spin" />}</span></div>
        {!current ? <div role="status" className="flex min-h-64 items-center justify-center p-6 text-sm text-slate-500">{error ? "Statistik tidak tersedia. Silakan coba lagi." : "Memuat statistik pengunjung…"}</div> : <>
          {current.total_in === 0 && <p className="px-5 pt-5 text-sm text-slate-500">Belum ada event masuk yang tercatat pada tanggal ini.</p>}
          <div className="overflow-x-auto px-5 pt-8 pb-5">
            <div className="relative min-w-[850px] h-60" role="group" aria-label="Grafik jumlah pengunjung masuk per jam. Pilih jam untuk melihat jumlahnya.">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="absolute top-0 left-0 w-full h-48 overflow-visible">
                <defs>
                  <linearGradient id="gradientCurve" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal Grid Lines */}
                {[0, 1, 2, 3].map((i) => (
                  <line key={i} x1="0" y1={svgHeight - paddingY - i * ((svgHeight - paddingY * 2) / 3)} x2={svgWidth} y2={svgHeight - paddingY - i * ((svgHeight - paddingY * 2) / 3)} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
                ))}

                {/* Fill Area */}
                {fillD && <path d={fillD} fill="url(#gradientCurve)" />}
                
                {/* Curve Line */}
                {curveD && <path d={curveD} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                
                {/* Points and Interaction */}
                {points.map((p) => {
                  const isSelected = selectedHour === p.hour.hour;
                  return (
                    <g key={p.hour.hour} className="group cursor-pointer" onClick={() => setSelectedHour(p.hour.hour)}>
                      {/* Invisible wider area for easier clicking */}
                      <circle cx={p.x} cy={p.y} r="16" fill="transparent" />
                      
                      <circle cx={p.x} cy={p.y} r={isSelected ? "6" : "4"} fill={isSelected ? "#4f46e5" : "#ffffff"} stroke="#4f46e5" strokeWidth={isSelected ? "3" : "2"} className="transition-all duration-200 group-hover:r-6 group-hover:fill-indigo-100" />
                      
                      {/* Count label above point */}
                      <text x={p.x} y={p.y - 14} textAnchor="middle" className={`text-[10px] font-medium transition-colors ${isSelected ? "fill-indigo-700" : "fill-slate-500 opacity-0 group-hover:opacity-100"}`}>
                        {p.hour.in_count}
                      </text>
                    </g>
                  );
                })}
              </svg>
              
              {/* X Axis Labels */}
              <div className="absolute top-48 left-0 w-full flex justify-between mt-3 px-[4px]">
                {current.hours.map((hour) => (
                  <button type="button" key={hour.hour} onClick={() => setSelectedHour(hour.hour)} className={`text-[10px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1 -ml-3 w-6 text-center ${selectedHour === hour.hour ? "font-semibold text-indigo-700" : "text-slate-500 hover:text-slate-700"}`}>
                    {hour.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500"><span>Klik jam untuk melihat jumlah pengunjung. Geser grafik untuk melihat seluruh jam.</span><span>Diperbarui setiap 30 detik untuk hari ini.</span></div>
          <details className="border-t border-slate-100"><summary className="cursor-pointer px-5 py-4 text-sm font-medium text-indigo-600">Lihat rincian per jam</summary><div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Jumlah pengunjung masuk per jam pada {date}, {current.timezone}</caption><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th scope="col" className="px-5 py-3">Jam ({current.timezone})</th><th scope="col" className="px-5 py-3 text-right">Orang masuk</th></tr></thead><tbody>{current.hours.map((hour) => <tr key={hour.hour} className="border-t border-slate-100"><th scope="row" className="px-5 py-2 font-normal">{hour.label}–{String(hour.hour).padStart(2, "0")}:59</th><td className="px-5 py-2 text-right tabular-nums">{hour.in_count.toLocaleString("id-ID")}</td></tr>)}</tbody></table></div></details>
        </>}
      </div>
    </section>
  );
}
