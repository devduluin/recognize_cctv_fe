/* eslint-disable */
"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import Link from "next/link";
import { AlertTriangle, Activity, ArrowUpRight, Camera, CircleHelp, Download, Loader2, LogIn, LogOut, Pause, Play, RefreshCw, Settings2, Square, Users, Video, Calendar, Clock, MapPin } from "lucide-react";
import HourlyVisitorStatistics from "../../components/hourly-visitor-statistics";
import { MetricCard, MonitorStatus, monitorButton, monitorPanel } from "../../components/monitoring-ui";

const API_BASE = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/event_visitor";
const EVENTS_API = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/events";
async function readResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { detail: raw }; }
}
function getCompanyId() {
  try {
    const user = JSON.parse(localStorage.getItem("user_info") || "null");
    const companyId = user?.account_type === "personal" ? user?.id || "" : user?.company_id || "";
    return companyId || localStorage.getItem("cctv_company_id") || "";
  } catch { return ""; }
}
type Status = {
  running: boolean; camera_source: string | number | null; session_id: string | null;
  status?: "running" | "paused" | "completed" | "stopped" | "not_started";
  unique_visitor_count: number; total_count: number; in_count: number; out_count: number;
  male_count: number; female_count: number; unknown_gender_count: number;
  timezone?: string;
  last_visitor_at: string | null; last_error?: string;
};

export default function EventVisitorPage({ eventId: fixedEventId = "" }: { eventId?: string }) {
  const [events, setEvents] = useState<any>([]);
  const [selectedEventId, setSelectedEventId] = useState(fixedEventId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [actionError, setActionError] = useState("");
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(0);

  const refreshStatus = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) return;
    try {
      const eventQuery = selectedEventId ? `&event_id=${encodeURIComponent(selectedEventId)}` : "";
      const response = await fetch(`${API_BASE}/status?company_id=${encodeURIComponent(companyId)}${eventQuery}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Status kamera belum dapat dimuat. Coba muat ulang.");
      const payload = await readResponse(response);
      setStatus(payload.result);
      setConnectionError("");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Koneksi kamera tidak tersedia.");
    }
  }, [selectedEventId]);

  useEffect(() => {
    const timeout = window.setTimeout(refreshStatus, 0);
    const interval = setInterval(refreshStatus, 3000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [refreshStatus]);

  const fetchEvents = useCallback(async () => {
    try {
      let url = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/events";
      try {
        const userInfoStr = localStorage.getItem("user_info");
        if (userInfoStr) {
          const user = JSON.parse(userInfoStr);
          const cid = user.account_type === "personal" ? user.id : user.company_id;
          if (cid) url += `?company_id=${encodeURIComponent(cid)}`;
        }
      } catch {}
      
      const response = await fetch(url);
      if (response.ok) {
          const payload = await readResponse(response);
        if (payload.result) setEvents(payload.result);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (fixedEventId) return;
    try { setSelectedEventId(localStorage.getItem("event_visitor_event_id") || ""); } catch {}
  }, [fixedEventId]);

  const selectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    try { localStorage.setItem("event_visitor_event_id", eventId); } catch {}
  };

  const handleAction = async (action: "start" | "pause" | "stop") => {
    setBusy(true);
    setActionError("");
    try {
      if (action === "stop" && !window.confirm("Stop monitoring event ini? Sesi aktif akan ditandai selesai.")) {
        return;
      }
      const options: RequestInit = { method: "POST" };
      if (action === "start") {
        if (!selectedEventId) {
          throw new Error("Silakan pilih event sebelum memulai sistem.");
        }
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify({ 
          event_id: selectedEventId
        });
      }
      const eventQuery = selectedEventId ? `&event_id=${encodeURIComponent(selectedEventId)}` : "";
      const response = await fetch(`${API_BASE}/${action}?company_id=${encodeURIComponent(getCompanyId())}${eventQuery}`, options);
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : payload.message || "Perintah belum berhasil. Coba lagi.");
      setStreamError(false);
      setStreamKey((key) => key + 1);
      await refreshStatus();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Tidak dapat menjalankan perintah.");
    } finally { setBusy(false); }
  };

  const running = Boolean(status?.running);
  const canStop = Boolean(status?.session_id);
  const configured = status?.camera_source != null && String(status.camera_source).trim() !== "";
  const statusLabel = connectionError
    ? "Offline"
    : !status
      ? "Menghubungkan"
      : status.last_error
        ? "Error"
        : (({ running: "Running", paused: "Paused", completed: "Completed", stopped: "Stopped", not_started: "Not started" } as Record<string, string>)[status.status || (running ? "running" : "not_started")] || "Not started");
  const value = (count: number | undefined) => status ? (count ?? 0).toLocaleString("id-ID") : "—";
  const demographics = [
    { label: "Laki-laki", count: status?.male_count ?? 0, color: "bg-sky-500", dot: "bg-sky-100 text-sky-600" },
    { label: "Perempuan", count: status?.female_count ?? 0, color: "bg-violet-500", dot: "bg-violet-100 text-violet-600" },
    { label: "Belum teridentifikasi", count: status?.unknown_gender_count ?? 0, color: "bg-slate-300", dot: "bg-slate-100 text-slate-500" },
  ];
  const demographicTotal = demographics.reduce((sum, item) => sum + item.count, 0);
  
  const currentEvent = events.find((e: any) => e.id === selectedEventId);
  const currentInside = Math.max(0, (status?.in_count || 0) - (status?.out_count || 0));
  const isOvercapacity = currentEvent?.capacity && currentInside > currentEvent.capacity;


  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Operations / Event Visitor</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{fixedEventId ? "Detail Event" : "Monitor Pengunjung"}</h1><p className="mt-2 text-sm text-slate-500">Pantau arus masuk, keluar, dan aktivitas pengunjung secara langsung.</p></div>
        <div className="flex items-center gap-3"><MonitorStatus label={statusLabel} running={running} error={Boolean(connectionError || status?.last_error)} />{fixedEventId && (
          <div className="relative">
            <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className={monitorButton}>
              <Download size={16} />Download Report
            </button>
            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg z-50">
                <a href={`${EVENTS_API}/${encodeURIComponent(fixedEventId)}/report?company_id=${encodeURIComponent(getCompanyId())}&format=pdf`} download className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={() => setShowDownloadMenu(false)}>PDF (.pdf)</a>
                <a href={`${EVENTS_API}/${encodeURIComponent(fixedEventId)}/report?company_id=${encodeURIComponent(getCompanyId())}&format=excel`} download className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={() => setShowDownloadMenu(false)}>Excel (.xlsx)</a>
                <a href={`${EVENTS_API}/${encodeURIComponent(fixedEventId)}/report?company_id=${encodeURIComponent(getCompanyId())}&format=csv`} download className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={() => setShowDownloadMenu(false)}>CSV (.csv)</a>
              </div>
            )}
          </div>
        )}<Link href="/settings?tab=visitor" className={monitorButton}><Settings2 size={16} />Pengaturan</Link></div>
      </div>

      
      {isOvercapacity && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
          <AlertTriangle size={24} className="text-red-500 shrink-0" />
          <div>
            <h3 className="font-semibold">Peringatan: Overcapacity!</h3>
            <p className="text-sm">Jumlah pengunjung saat ini ({currentInside}) telah melebihi kapasitas maksimal event ({currentEvent.capacity}).</p>
          </div>
        </div>
      )}
      
      {currentEvent && (
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-6 shadow-sm">
          <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-indigo-500/5 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-6 translate-y-6 rounded-full bg-indigo-500/5 blur-2xl"></div>
          
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="inline-flex max-w-fit items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-700">Informasi Event</span>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{currentEvent.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-y-2 gap-x-5 text-sm font-medium text-slate-600">
                <span className="flex items-center gap-2"><Calendar size={16} className="text-indigo-500" />{(currentEvent.event_date || currentEvent.created_at) ? new Date(currentEvent.event_date || currentEvent.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "-"}</span>
                <span className="flex items-center gap-2"><Clock size={16} className="text-indigo-500" />{currentEvent.event_start || "-"} s/d {currentEvent.event_end || "-"}</span>
                <span className="flex items-center gap-2"><MapPin size={16} className="text-indigo-500" />{currentEvent.location || "Lokasi belum ditentukan"}</span>
                <span className="flex items-center gap-2"><Users size={16} className="text-indigo-500" />{currentEvent.capacity ? `Kapasitas: ${currentEvent.capacity} orang` : "Kapasitas: Tidak dibatasi"}</span>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-3">
              <div className="flex flex-col items-start sm:items-end gap-1">
                 <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Garis Hitung</span>
                 <span className="text-sm font-medium text-slate-700 capitalize">{currentEvent.line_orientation || "Horizontal"} · Posisi {Math.round((currentEvent.line_position || 0.5) * 100)}%</span>
              </div>
              {currentEvent.auto_run && (
                 <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200/50"><RefreshCw size={12} /> Auto-run Aktif</span>
              )}
            </div>
          </div>
        </div>
      )}

      {(connectionError || actionError || status?.last_error) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{connectionError || actionError || status?.last_error}</span><button type="button" onClick={refreshStatus} className="inline-flex items-center gap-2 font-medium"><RefreshCw size={16} />Muat ulang</button></div>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5 text-white"><div className="flex items-center gap-3"><Camera size={18} className="text-slate-400" /><h2 className="text-sm font-semibold">Live Camera</h2></div><button type="button" aria-label="Muat ulang video" disabled={!running || Boolean(connectionError)} onClick={() => { setStreamError(false); setStreamKey((key) => key + 1); }} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 disabled:opacity-40"><RefreshCw size={16} /></button></div>
          <div className="relative flex aspect-video items-center justify-center bg-slate-950">
            {running && !connectionError && !streamError ? (
              // Native image required for the MJPEG camera stream.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${status?.session_id}-${streamKey}`} src={`${API_BASE}/stream?company_id=${encodeURIComponent(getCompanyId())}${selectedEventId ? `&event_id=${encodeURIComponent(selectedEventId)}` : ""}`} alt="Live kamera Event Visitor" className="h-full w-full object-contain" onError={() => setStreamError(true)} />
            ) : <div className="px-5 py-8 text-center"><span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400"><Video size={28} strokeWidth={1.5} /></span><p className="text-sm font-medium text-slate-200">{connectionError ? "Koneksi kamera terputus" : streamError && running ? "Preview belum tersedia" : "Monitoring belum berjalan"}</p><p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-slate-500">{running ? "Muat ulang untuk menghubungkan kembali preview kamera." : "Mulai sistem untuk melihat video dan garis penghitung pengunjung."}</p></div>}
            <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/75 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-300"><span className={`h-1.5 w-1.5 rounded-full ${running && !connectionError && !streamError ? "bg-emerald-400" : "bg-slate-500"}`} />{running && !connectionError && !streamError ? "Live feed" : "Standby"}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-5 py-4 text-xs text-slate-400"><span>Deteksi wajah & penghitungan garis</span><Link href="/settings?tab=visitor" className="inline-flex items-center gap-1.5 font-medium text-indigo-300">Atur kamera<ArrowUpRight size={14} /></Link></div>
          <section className="flex flex-col gap-5 border-t border-white/10 bg-slate-900 p-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Video size={21} /></span><div><h2 className="text-sm font-semibold">Kontrol monitoring</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">{!status ? "Menunggu status kamera." : !configured ? "Atur sumber kamera untuk memulai monitoring." : running ? "Sistem sedang menghitung pengunjung dari kamera." : "Kamera siap. Mulai sistem untuk membuka sesi penghitungan."}</p></div></div>
              <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || running || !configured || Boolean(connectionError)} onClick={() => handleAction("start")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}Mulai Sistem</button><button type="button" disabled={busy || !running} onClick={() => handleAction("pause")} className={monitorButton}><Pause size={15} className="text-amber-500" />Pause</button><button type="button" disabled={busy || !canStop} onClick={() => handleAction("stop")} className="inline-flex items-center gap-2 rounded-xl border border-red-300/30 px-4 py-2.5 text-sm font-medium text-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"><Square size={15} />Stop</button></div>
            </div>
            
            {!running && !fixedEventId && (
              <div className="border-t border-white/10 pt-5 mt-1 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Pilih Event</label>
                    <select 
                      value={selectedEventId} 
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => selectEvent(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Pilih Event yang Akan Dimonitor --</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>{e.name} {e.event_start && e.event_end ? `(${e.event_start} - ${e.event_end})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <Link href="/events" className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors text-sm border border-white/10 whitespace-nowrap">
                    Buat Event Baru
                  </Link>
                </div>
              </div>
            )}
          </section>
        </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <MetricCard label="Pengunjung unik" value={value(status?.unique_visitor_count)} detail="Wajah unik pada sesi ini" icon={Users} />
        <MetricCard label="Total masuk" value={value(status?.in_count)} detail="Tercatat melewati garis masuk" icon={LogIn} tone="emerald" />
        <MetricCard label="Total keluar" value={value(status?.out_count)} detail="Tercatat melewati garis keluar" icon={LogOut} tone="amber" />
        <MetricCard label="Di dalam area" value={value(status?.total_count)} detail="Estimasi jumlah pengunjung saat ini" icon={Activity} tone="sky" />
      </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="contents">
          <section className={`${monitorPanel} p-5`}>
            <h2 className="text-sm font-semibold">Profil Pengunjung</h2><p className="mt-1 text-xs text-slate-500">Komposisi wajah unik pada sesi ini.</p>
            <div className="my-6 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">{demographics.map((item) => <span key={item.label} className={item.color} style={{ width: `${demographicTotal ? item.count / demographicTotal * 100 : 0}%` }} />)}</div>
            <div className="space-y-5">{demographics.map((item) => <div key={item.label} className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${item.color}`} /><span className="text-xs text-slate-600">{item.label}</span></div><div className="flex items-center gap-3"><span className="text-xs text-slate-400">{demographicTotal ? Math.round(item.count / demographicTotal * 100) : 0}%</span><span className="min-w-6 text-right text-sm font-semibold tabular-nums">{value(item.count)}</span></div></div>)}</div>
            <p className="mt-6 flex gap-2 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-400"><CircleHelp size={14} className="shrink-0 mt-0.5" />Gender yang belum dikenali masuk ke kategori belum teridentifikasi.</p>
          </section>
          <section className={`${monitorPanel} p-5`}><h2 className="text-sm font-semibold">Aktivitas Sesi</h2><dl className="mt-4 space-y-4"><div><dt className="text-xs text-slate-400">Visitor terakhir</dt><dd className="mt-1 text-sm font-medium">{status?.last_visitor_at ? new Date(status.last_visitor_at).toLocaleString("id-ID", { timeZone: status.timezone || "Asia/Jakarta" }) + ` (${status.timezone || "Asia/Jakarta"})` : "Belum ada aktivitas"}</dd></div><div><dt className="text-xs text-slate-400">Session ID</dt><dd className="mt-1 break-all font-mono text-[11px] text-slate-500">{status?.session_id || "—"}</dd></div></dl><Link href="/" className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-indigo-600">Lihat statistik per jam<ArrowUpRight size={14} /></Link></section>
        </div>
      </div>
      <HourlyVisitorStatistics companyId={getCompanyId()} eventId={selectedEventId} />
    </main>
  );
}
