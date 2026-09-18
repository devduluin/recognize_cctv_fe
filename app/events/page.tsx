/* eslint-disable */
"use client";
import React, { useState, useEffect, useCallback, useMemo, FormEvent } from "react";
import Link from "next/link";
import CameraTestPreview from "../../components/camera-test-preview";
import { ArrowRight, ArrowLeft, Plus, Calendar, Trash2, Clock, Search, X, Pencil } from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/events";

type VisitorEvent = {
  id: string;
  name: string;
  location?: string | null;
  camera_source?: string | null;
  line_position?: number | null;
  line_orientation?: string | null;
  reverse_direction?: boolean | null;
  event_date?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  auto_run?: boolean;
  capacity?: number | null;
  status?: string;
  visitor_count?: number;
  created_at?: string;
};

const statusStyles: Record<string, { label: string; badge: string; dot: string }> = {
  running: { label: "Running", badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/10", dot: "bg-emerald-500" },
  paused: { label: "Paused", badge: "bg-amber-50 text-amber-700 ring-amber-600/10", dot: "bg-amber-500" },
  completed: { label: "Completed", badge: "bg-slate-100 text-slate-600 ring-slate-500/10", dot: "bg-slate-400" },
  stopped: { label: "Stopped", badge: "bg-rose-50 text-rose-700 ring-rose-600/10", dot: "bg-rose-500" },
};

export default function EventsPage() {
  const [events, setEvents] = useState<VisitorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [cameraSource, setCameraSource] = useState("");
  const [linePosition, setLinePosition] = useState(50);
  const [lineOrientation, setLineOrientation] = useState("horizontal");
  const [reverseDirection, setReverseDirection] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldClass = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
  const [eventDate, setEventDate] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [autoRun, setAutoRun] = useState(true);
  const [capacity, setCapacity] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) setIsCreateModalOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isCreateModalOpen, isSubmitting]);

  const visibleEvents = useMemo(() => {
    const query = eventQuery.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) => String(event.name || "").toLowerCase().includes(query));
  }, [eventQuery, events]);

  const fetchEvents = useCallback(async () => {
    try {
      let url = API_BASE;
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
        const payload = await response.json();
        if (payload.result) setEvents(payload.result);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsSubmitting(true);
    setFormError("");
    
    let company_id = undefined;
    try {
      const userInfoStr = localStorage.getItem("user_info");
      if (userInfoStr) {
        const user = JSON.parse(userInfoStr);
        company_id = user.account_type === "personal" ? user.id : user.company_id;
      }
    } catch {}

    try {
      const query = company_id ? `?company_id=${encodeURIComponent(company_id)}` : "";
      const response = await fetch(editingEventId ? `${API_BASE}/${encodeURIComponent(editingEventId)}${query}` : API_BASE, {
        method: editingEventId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: location.trim() || null, camera_source: cameraSource.trim() || null, line_position: linePosition / 100, line_orientation: lineOrientation, reverse_direction: reverseDirection, name, capacity: capacity ? parseInt(capacity, 10) : null, event_date: eventDate || undefined, event_start: eventStart, event_end: eventEnd, auto_run: autoRun, company_id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(typeof payload?.detail === "string" ? payload.detail : "Event belum dapat disimpan. Periksa isian dan coba lagi.");
      }
      if (response.ok) {
        setName("");
        setEventDate("");
        setEventStart("");
        setEventEnd("");
        setAutoRun(true);
        setCapacity("");
        setEditingEventId(null);
        setIsCreateModalOpen(false);
        fetchEvents();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Event belum dapat disimpan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setLocation(""); setCameraSource(""); setLinePosition(50);
    setLineOrientation("horizontal"); setReverseDirection(false); setFormError("");
    setName("");
    setEventDate(new Date().toLocaleDateString("en-CA"));
    setEventStart("");
    setEventEnd("");
    setAutoRun(true);
        setCapacity("");
    setEditingEventId(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (event: VisitorEvent) => {
    setLocation(event.location || ""); setCameraSource(event.camera_source ?? "");
    setLinePosition(Math.round((event.line_position ?? 0.5) * 100));
    setLineOrientation(event.line_orientation ?? "horizontal");
    setReverseDirection(event.reverse_direction ?? false); setFormError("");
    setName(event.name || "");
    setEventDate(event.event_date || "");
    setEventStart(event.event_start || "");
    setEventEnd(event.event_end || "");
    setAutoRun(event.auto_run !== false);
    setCapacity(event.capacity ? String(event.capacity) : "");
    setEditingEventId(event.id);
    setIsCreateModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus event ini?")) return;
    try {
      const user = JSON.parse(localStorage.getItem("user_info") || "null");
      const companyId = user?.account_type === "personal" ? user?.id : user?.company_id;
      const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
      const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}${query}`, { method: "DELETE" });
      if (response.ok) fetchEvents();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:py-10">
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-slate-200/80 pb-7">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Calendar size={23} />
          </span>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Event Configuration</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Manajemen Event</h1>
            <p className="mt-2 text-sm text-slate-500">Kelola daftar event yang akan digunakan pada sistem monitoring.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          title="Buat event baru"
          aria-label="Buat event baru"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-2"
        >
          <Plus size={21} />
        </button>
      </div>

      <div>
        {/* List Events */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold text-slate-950">Daftar Event</h2>
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">{events.length} event</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Event yang tersedia untuk dimonitor.</p>
              </div>
              <div className="relative w-full sm:max-w-[220px]">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={eventQuery}
                  onChange={(e) => setEventQuery(e.target.value)}
                  placeholder="Cari event..."
                  aria-label="Cari event"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
            
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-400">Memuat data...</div>
              ) : events.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                    <Calendar size={20} />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900">Belum ada event</h3>
                  <p className="mt-1 text-xs text-slate-500">Gunakan tombol + untuk membuat event pertama.</p>
                </div>
              ) : visibleEvents.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                    <Search size={20} />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900">Event tidak ditemukan</h3>
                  <p className="mt-1 text-xs text-slate-500">Coba gunakan kata kunci lain.</p>
                </div>
              ) : (
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Event</th>
                      <th className="px-5 py-3.5">Jadwal</th>
                      <th className="px-5 py-3.5 text-center">Pengunjung</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleEvents.map((ev) => {
                      const status = statusStyles[ev.status || ""] || { label: "Not started", badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/10", dot: "bg-indigo-500" };
                      return (
                        <tr key={ev.id} className="group transition-colors hover:bg-indigo-50/30">
                          <td className="px-5 py-4">
                            <div className="flex min-w-[220px] items-center gap-2.5">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
                              <span className="truncate font-semibold text-slate-900">{ev.name}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-2"><Calendar size={14} className="text-slate-400" />{(ev.event_date || ev.created_at) ? new Date(ev.event_date || ev.created_at || "").toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : "-"}</span>
                            <span className="mt-1 inline-flex items-center gap-2"><Clock size={14} className="text-slate-400" />{ev.event_start || "-"} s/d {ev.event_end || "-"}</span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="inline-flex min-w-10 items-center justify-center rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-900">{Number(ev.visitor_count || 0).toLocaleString("id-ID")}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${status.badge}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(ev)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                                title="Edit Event"
                                aria-label={`Edit ${ev.name}`}
                              >
                                <Pencil size={16} />
                              </button>
                              <Link href={`/events/${ev.id}`} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700">
                                Detail <ArrowRight size={14} />
                              </Link>
                              <button
                                onClick={() => handleDelete(ev.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                title="Hapus Event"
                                aria-label={`Hapus ${ev.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
      </div>

      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-event-title"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsCreateModalOpen(false); }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  {editingEventId ? <Pencil size={18} /> : <Plus size={18} />}
                </span>
                <div>
                  <h2 id="create-event-title" className="text-base font-semibold text-slate-950">{editingEventId ? "Edit Event" : "Buat Event Baru"}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{editingEventId ? "Perbarui lokasi, jadwal, kamera, dan garis hitung." : "Tambahkan event ke dalam sistem."}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                title="Tutup"
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="max-h-[calc(100vh-180px)] overflow-y-auto p-5">
              <fieldset disabled={isSubmitting} className="space-y-4 disabled:opacity-60">
                {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Nama Event</label>
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Pameran Teknologi 2026"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Kapasitas Event (Opsional)</label>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="Contoh: 500"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      min="1"
                    />
                  </div>
                </div>

                <label className="block text-sm font-medium">Lokasi Event<input value={location} maxLength={500} onChange={(e) => setLocation(e.target.value)} placeholder="Gedung, alamat, atau area acara" className={fieldClass} /></label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Tanggal</label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Mulai</label>
                    <input
                      type="time"
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Selesai</label>
                    <input
                      type="time"
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-sm transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-3">
                  <span>
                    <span className="block text-sm font-medium text-slate-700">Jalankan otomatis</span>
                    <span className="mt-0.5 block text-xs text-slate-500">Mulai dan berhenti mengikuti tanggal serta jam event.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={(e) => setAutoRun(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                </label>
                <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div><h3 className="text-sm font-semibold">Kamera & Garis Hitung</h3><p className="mt-1 text-xs text-slate-500">Konfigurasi khusus untuk event ini.</p></div>
                  <label className="block text-sm font-medium">Sumber Kamera<input value={cameraSource} onChange={(e) => setCameraSource(e.target.value)} placeholder="0, rtsp://host/stream, atau path video" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-slate-500">Kosongkan untuk memakai kamera company.</span></label>
                  <label className="block text-sm font-medium">Orientasi Garis<select value={lineOrientation} onChange={(e) => setLineOrientation(e.target.value)} className={fieldClass}><option value="horizontal">Horizontal</option><option value="vertical">Vertikal</option></select></label>
                  <label className="block text-sm font-medium">Posisi Garis · {linePosition}%<input type="range" min="10" max="90" value={linePosition} onChange={(e) => setLinePosition(Number(e.target.value))} className="mt-3 block w-full accent-indigo-600" /></label>
                  <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={reverseDirection} onChange={(e) => setReverseDirection(e.target.checked)} className="accent-indigo-600" />Balik arah masuk/keluar</label>
                  <p className="text-xs text-slate-500">Arah masuk: {lineOrientation === "horizontal" ? reverseDirection ? "bawah → atas" : "atas → bawah" : reverseDirection ? "kanan → kiri" : "kiri → kanan"}.</p>
                  <CameraTestPreview key={cameraSource} source={cameraSource} position={linePosition} orientation={lineOrientation} reversed={reverseDirection} />
                </section>
              </fieldset>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!name || isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <>{editingEventId ? <Pencil size={16} /> : <Plus size={16} />}{editingEventId ? "Update Event" : "Simpan Event"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );}
