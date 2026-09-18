"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { LayoutGrid, Maximize2, Camera, ScanFace, Search, Users, Activity, Settings, Play, Square, RotateCw, ArrowRight, Power, Video, ListRestart, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { MetricCard, MonitorStatus, monitorButton, monitorPanel } from "../../components/monitoring-ui";

const API_BASE = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/cctv";

export default function LivePreview() {
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [cameraView, setCameraView] = useState<"grid" | "focus">("grid");
  const [focusCameraId, setFocusCameraId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [setupReady, setSetupReady] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [systemStarted, setSystemStarted] = useState(false);
  const [systemReady, setSystemReady] = useState(false);
  const [systemRunning, setSystemRunning] = useState(false);
  const [systemInitializing, setSystemInitializing] = useState(false);
  
  const [status, setStatus] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [toastMessage, setToastMessage] = useState("");

  const toastTimer = useRef(null);

  const showToast = (message) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastMessage("");
    }, 3200);
  };

  const api = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const message = payload?.detail || payload?.message || `Request failed (${response.status})`;
      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }
    return payload?.result ?? payload;
  };

  const resolveCompanyId = async () => {
    try {
      const userInfoStr = localStorage.getItem("user_info");
      if (userInfoStr) {
        const user = JSON.parse(userInfoStr);
        if (user.account_type === "personal") return user.id;
        if (user.company_id) return user.company_id;
      }
    } catch {}

    const saved = localStorage.getItem("cctv_company_id") || "";
    if (saved) return saved;
    try {
      const config = await api("/config");
      const cid = config?.company_id || "";
      if (cid) localStorage.setItem("cctv_company_id", cid);
      return cid;
    } catch {
      return "";
    }
  };

  const loadCameras = async (cid, quiet = false) => {
    if (!cid) {
      setCameras([]);
      return;
    }
    try {
      const data = await api(`/cameras/${encodeURIComponent(cid)}`);
      setCameras(Array.isArray(data) ? data : []);
      if (!quiet) showToast("Daftar kamera dimuat");
    } catch (error) {
      setCameras([]);
      if (!quiet) showToast(error.message);
    }
  };

  const loadHomeSetup = async (cid, quiet = false) => {
    if (!cid) {
      setSetupReady(false);
      return false;
    }
    try {
      const settings = await api(`/settings/${encodeURIComponent(cid)}`);
      const ready = Boolean(settings.company_setting_exists && settings.enabled);
      setSetupReady(ready);
      return ready;
    } catch (error) {
      setSetupReady(false);
      if (!quiet) showToast(error.message);
      return false;
    }
  };

  const refreshStatus = useCallback(async (cid = companyId) => {
    if (!cid) return;
    try {
      const stat = await api(`/status?company_id=${encodeURIComponent(cid)}`);
      setStatus(stat);
      setWorkers(Array.isArray(stat.workers) ? stat.workers : []);
      setSystemStarted(Boolean(stat.system_started));
      setSystemReady(Boolean(stat.system_ready));
      setSystemRunning(Boolean(stat.running));
      setSystemInitializing(Boolean(stat.system_initializing));
    } catch (error) {
      setStatus({ error: true, label: "API Error" });
      showToast(error.message);
    }
  }, [companyId]);

  const refreshAttendance = useCallback(async (currentCid = null) => {
    const cid = typeof currentCid === "string" ? currentCid : companyId;
    if (!cid) return;
    try {
      const records = await api(`/attendance?company_id=${encodeURIComponent(cid)}`); // DB fallback
      let sessionRecords = {};
      try {
        sessionRecords = await api(`/attendance?source=session&company_id=${encodeURIComponent(cid)}`);
      } catch (e) {
        // ignore
      }
      
      const merged = { ...records };
      for (const [id, val] of Object.entries(sessionRecords)) {
        if (merged[id]) {
          merged[id] = { ...merged[id], ...val };
        } else {
          merged[id] = val;
        }
      }
      
      setAttendance(merged);
    } catch (error) {
      showToast(error.message);
    }
  }, [companyId]);

  useEffect(() => {
    let statusInterval;
    let attendanceInterval;
    const init = async () => {
      const cid = await resolveCompanyId();
      setCompanyId(cid);
      const isReady = await loadHomeSetup(cid, true);
      if (!isReady) {
        await refreshStatus();
        return;
      }
      await loadCameras(cid, true);
      await refreshStatus();
      await refreshAttendance(cid);
      
      statusInterval = setInterval(refreshStatus, 2000);
      attendanceInterval = setInterval(() => refreshAttendance(cid), 5000);
    };
    init();

    return () => {
      if (statusInterval) clearInterval(statusInterval);
      if (attendanceInterval) clearInterval(attendanceInterval);
    };
  }, [refreshStatus, refreshAttendance]);

  const runWorkerAction = async (action, cameraId = null) => {
    setBusy(true);
    try {
      let path = `/${action}`;
      if (cameraId) {
        path += `?camera_id=${encodeURIComponent(cameraId)}`;
      }
      await api(path, { method: "POST" });
      showToast(action === "start" ? "CCTV dinyalakan" : "CCTV dihentikan");
      await refreshStatus();
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  };

  const homeReady = setupReady && cameras.length > 0;
  
  const setupRequiredMessage = () => {
    if (!companyId) return "Company ID belum ditemukan. Buka halaman CCTV Settings memakai link company yang benar.";
    if (!setupReady) return "Company ini belum setup atau CCTV belum aktif. Setup company settings dulu sebelum membuka preview.";
    return "Company settings sudah aktif, tapi kamera belum disiapkan. Tambahkan kamera masuk atau keluar dulu.";
  };

  const progressPercent = (stat) => {
    if (!stat) return 0;
    const percent = Number(stat.initialization_progress_percent ?? 0);
    if (!Number.isFinite(percent)) return 0;
    return Math.max(0, Math.min(100, Math.round(percent)));
  };

  const workerById = (id) => workers.find((w) => w.camera_id === id) || null;

  const getWorkerPill = () => {
    if (!status) return { running: false, error: false, label: "Checking" };
    if (status.error) return { error: true, label: status.running ? "Running Error" : "Error" };
    if (status.initializing) return { label: `Initializing ${progressPercent(status)}%` };
    if (status.running) return { running: true, label: `Running ${status.running_count || 0}/${status.worker_count || 0}` };
    return { label: "Stopped" };
  };
  const pill = getWorkerPill();

  const getCameraSourceText = () => {
    const runningNames = workers.filter(w => w.running || w.initializing).map(w => w.camera_name).filter(Boolean);
    if (runningNames.length) return runningNames.join(", ");
    if (cameras.length) return `${cameras.length} kamera tersimpan`;
    return "Belum ada kamera tersimpan";
  };

  const renderAttendanceRow = (employeeId, value) => {
    const name = value?.employee_name || employeeId;
    const urlIn = value?.photo_in ? (value.photo_in.startsWith("http") || value.photo_in.startsWith("/") ? value.photo_in : `/${value.photo_in}`) : "";
    const urlOut = value?.photo_out ? (value.photo_out.startsWith("http") || value.photo_out.startsWith("/") ? value.photo_out : `/${value.photo_out}`) : "";

    const shiftName = value?.shift_name || value?.shift_type_name || "-";
    const checkinStatus = value?.checkin_status || "-";
    const checkoutStatus = value?.checkout_status || "-";

    const getStatusColor = (status) => {
      if (status.includes("ontime") || status.includes("on_time") || status === "approved" || status === "present") return "text-emerald-600 bg-emerald-400/10 border-emerald-400/20";
      if (status.includes("late") || status.includes("early_checkout")) return "text-amber-600 bg-amber-400/10 border-amber-400/20";
      if (status.includes("missing")) return "text-red-600 bg-red-400/10 border-red-400/20";
      return "text-slate-500 bg-slate-50 border-slate-200";
    };

    return (
      <motion.tr 
        key={employeeId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm"
      >
        <td className="py-4 px-4 font-medium"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">{String(name).slice(0, 2).toUpperCase()}</span><span>{name}</span></div></td>
        <td className="py-3 px-4 text-slate-900/70">{shiftName}</td>
        <td className="py-3 px-4">
          <div className="flex flex-col gap-1.5 items-start">
            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${getStatusColor(checkinStatus)}`}>
              IN: {checkinStatus.replace("_", " ")}
            </span>
            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${getStatusColor(checkoutStatus)}`}>
              OUT: {checkoutStatus.replace("_", " ")}
            </span>
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {urlIn ? (
              <a className="block w-10 h-10 rounded overflow-hidden border border-slate-200" href={urlIn} target="_blank" rel="noreferrer" title={`In: ${name}`}>
                <img src={urlIn} alt="" loading="lazy" className="w-full h-full object-cover" />
              </a>
            ) : <div className="w-10 h-10 rounded border border-dashed border-slate-200 flex items-center justify-center text-slate-900/20 text-xs">In</div>}
            
            {urlOut ? (
              <a className="block w-10 h-10 rounded overflow-hidden border border-slate-200" href={urlOut} target="_blank" rel="noreferrer" title={`Out: ${name}`}>
                <img src={urlOut} alt="" loading="lazy" className="w-full h-full object-cover" />
              </a>
            ) : <div className="w-10 h-10 rounded border border-dashed border-slate-200 flex items-center justify-center text-slate-900/20 text-xs">Out</div>}
          </div>
        </td>
        <td className="py-3 px-4 text-slate-900/70">{value?.time_in || "-"}</td>
        <td className="py-3 px-4 text-slate-900/70">{value?.time_out || "-"}</td>
        <td className="py-3 px-4 text-right">
          {value?.id ? (
            <button
              onClick={async () => {
                if (confirm(`Hapus data absen untuk ${name}?`)) {
                  setBusy(true);
                  try {
                    await api(`/attendance/${value.id}`, { method: "DELETE" });
                    showToast(`Data ${name} dihapus`);
                    await refreshAttendance();
                  } catch (e) {
                    showToast(e.message);
                  } finally {
                    setBusy(false);
                  }
                }
              }}
              disabled={busy}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-400/10 rounded-lg transition-colors inline-flex disabled:opacity-50"
              title="Hapus data ini"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <span className="text-[10px] text-slate-500 italic">No ID</span>
          )}
        </td>
      </motion.tr>
    );
  };

  const hasCameras = cameras.length > 0;
  const isInitializing = Boolean(status?.initializing);
  const initPercent = progressPercent(status);

  const attendanceEntries = Object.entries(attendance);
  const filteredAttendance = attendanceEntries.filter(([id, value]) => {
    const record = value as { employee_name?: string };
    return `${record?.employee_name ?? ""} ${id}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"));
  });

  return (
    <div className="text-slate-900 font-sans selection:bg-indigo-500/30">
      {/* Page title and system status */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mx-auto max-w-[1440px] px-4 pt-8 pb-2 sm:px-8 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-[0.16em] text-indigo-600 font-semibold mb-2">Operations / CCTV</span>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Monitoring CCTV</h1>
          <p className="mt-2 text-sm text-slate-500">Pantau kamera, pengenalan wajah, dan kehadiran karyawan.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Link 
            href={companyId ? `/settings?tab=cctv&companyId=${encodeURIComponent(companyId)}` : "/settings?tab=cctv"}
            className={monitorButton}
          >
            <Settings size={16} />
            <span>Pengaturan</span>
          </Link>
          
          <MonitorStatus label={pill.label} running={Boolean(pill.running)} error={Boolean(pill.error)} />
        </div>
      </motion.header>

      <main className="max-w-[1440px] mx-auto px-4 py-6 sm:px-8 space-y-6 mt-4">
        {/* Cameras Panel */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-sm">
          <div className="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4"><div>
            <h2 className="text-lg font-medium text-white">Camera Wall</h2>
            <p className="mt-1 text-xs text-slate-400">{getCameraSourceText()}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {cameraView === "focus" && <select aria-label="Pilih kamera fokus" value={cameras.some((camera) => camera.id === focusCameraId) ? focusCameraId : cameras[0]?.id || ""} onChange={(event) => setFocusCameraId(event.target.value)} className="max-w-48 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white">{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name || "Kamera"}</option>)}</select>}
              <button type="button" aria-pressed={cameraView === "grid"} onClick={() => setCameraView("grid")} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${cameraView === "grid" ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400"}`}><LayoutGrid size={15} />Semua Kamera</button>
              <button type="button" aria-pressed={cameraView === "focus"} onClick={() => setCameraView("focus")} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${cameraView === "focus" ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400"}`}><Maximize2 size={15} />Fokus</button>
            </div>
          </div>

          <div className={`p-4 sm:p-5 grid grid-cols-1 gap-4 ${cameraView === "grid" ? "xl:grid-cols-2" : ""}`}>
            {cameras.length === 0 ? (
              <div className="col-span-full h-64 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-3">
                <Video size={32} opacity={0.5} />
                <span className="text-sm font-medium">Belum ada kamera tersimpan</span>
              </div>
            ) : (
              (cameraView === "grid" ? cameras : [cameras.find((camera) => camera.id === focusCameraId) || cameras[0]]).map(camera => {
                const worker = workerById(camera.id);
                const isRunning = Boolean(worker?.running);
                const isInit = Boolean(worker?.initializing);
                const isActive = isRunning || isInit;
                const statusLabel = worker?.error ? "Error" : isRunning ? "Running" : isInit ? "Starting" : "Stopped";
                return (
                  <motion.div 
                    layout
                    key={camera.id} 
                    className="p-4 bg-slate-900 border border-white/10 rounded-xl flex flex-col gap-4 relative overflow-hidden group"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="text-base font-medium text-slate-100">{camera.name || "Unnamed Camera"}</h3>
                        <p className="text-xs text-slate-400 mt-1 break-all">{camera.camera_source || "-"}</p>
                      </div>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${isRunning ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : worker?.error ? "bg-red-500/10 text-red-300 border-red-500/20" : "bg-slate-800 text-slate-500 border-white/10"}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="flex">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-700 rounded-md border border-slate-100">
                        {camera.zone_type || "attendance"}
                      </span>
                    </div>

                    <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                      {isRunning ? (
                        <img src={`${API_BASE}/stream?camera_id=${encodeURIComponent(camera.id)}&company_id=${encodeURIComponent(companyId)}`} alt="Stream" className="w-full h-full object-contain" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5"><Video size={24} strokeWidth={1.5} /></span>
                          <span className="text-xs font-medium">{statusLabel}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                      <span>Detection: <span className="text-slate-200">{worker?.last_detections?.length || 0}</span></span>
                      <span>Attendance: <span className="text-slate-200">{worker?.attendance_count || 0}</span></span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        className="py-2 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors disabled:opacity-50 text-sm font-medium"
                        disabled={busy || !homeReady || !systemReady || isActive}
                        onClick={() => runWorkerAction("start", camera.id)}
                      >
                        Start
                      </button>
                      <button 
                        className="py-2 bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 text-sm font-medium"
                        disabled={busy || !isActive} 
                        onClick={() => runWorkerAction("stop", camera.id)}
                      >
                        Stop
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          <AnimatePresence>
            {isInitializing && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-6 pb-6"
              >
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-medium text-indigo-300">
                    <span>{status?.initialization_stage || "Initializing"}</span>
                    <span>{initPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500" 
                      initial={{ width: 0 }}
                      animate={{ width: `${initPercent}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Wajah terdaftar" value={status?.registered_count ?? "—"} detail="Data wajah untuk pengenalan" icon={ScanFace} />
          <MetricCard label="Absensi sesi" value={status?.attendance_count ?? "—"} detail="Tercatat pada sesi monitoring" icon={Users} tone="emerald" />
          <MetricCard label="Kamera aktif" value={status ? `${workers.filter((worker) => worker.running).length} / ${cameras.length}` : "—"} detail="Kamera berjalan / terkonfigurasi" icon={Camera} tone="sky" />
          <MetricCard label="Pengenalan wajah" value={status ? status.recognition_enabled ? "Aktif" : "Nonaktif" : "—"} detail="Status pengenalan saat ini" icon={Activity} tone="amber" />
        </div>
        {/* Attendance Table */}
        <section className={monitorPanel}>
          <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-medium text-slate-900">Catatan Absensi</h2>
              <p className="text-sm text-slate-500">Catatan kehadiran karyawan yang tersedia untuk company ini.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button 
                className="px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50 text-sm font-medium shrink-0"
                disabled={busy || attendanceEntries.length === 0} 
                onClick={async () => {
                  if (confirm("Hapus semua data absensi dan foto? (Tidak bisa di-undo)")) {
                    setBusy(true);
                    try {
                      await api(`/attendance?company_id=${encodeURIComponent(companyId)}`, { method: "DELETE" });
                      showToast("Semua data absensi berhasil dihapus");
                      await refreshAttendance();
                    } catch (e) {
                      showToast(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }
                }}
              >
                Hapus Semua
              </button>
              <button 
                className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 text-slate-500 hover:text-slate-900 shrink-0"
                disabled={busy} 
                onClick={refreshAttendance}
                aria-label="Muat ulang absensi"
              >
                <ListRestart size={16} />
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:max-w-xs"><Search size={16} className="shrink-0 text-slate-400" /><input aria-label="Cari nama atau ID karyawan" placeholder="Cari nama atau ID karyawan…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-slate-400" /></label>
            <span className="text-xs text-slate-400">{filteredAttendance.length} dari {attendanceEntries.length} catatan</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="py-3 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Karyawan</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Shift</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status (In/Out)</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Snapshot</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Jam Masuk</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Jam Keluar</th>
                  <th className="py-3 px-4 text-[10px] uppercase tracking-wider text-slate-500 font-bold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredAttendance.length === 0 ? (
                    <motion.tr 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <td colSpan={7} className="py-12 text-center text-sm text-slate-500">{search.trim() ? "Tidak ada karyawan yang cocok dengan pencarian." : "Belum ada catatan absensi."}</td>
                    </motion.tr>
                  ) : (
                    filteredAttendance.map(([id, val]) => renderAttendanceRow(id, val))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 bg-white text-slate-900 px-4 py-3 rounded-xl font-medium shadow-sm flex items-center gap-3 z-50 text-sm"
          >
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
