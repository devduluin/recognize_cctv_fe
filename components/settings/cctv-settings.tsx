"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Video, RefreshCw, Save, Plus, Lock, LogIn, LogOut, Pencil, Trash2, ScanLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/cctv";

type RoiPoint = { x: number; y: number };

type Camera = {
  id: string;
  name?: string;
  camera_source?: string;
  zone_type?: string;
  roi_enabled?: boolean;
  roi_polygon?: RoiPoint[];
  clahe_enabled?: boolean;
  detection_confidence_threshold?: number | null;
  recognition_similarity_threshold?: number | null;
  reid_similarity_threshold?: number | null;
  track_confirm_hits?: number | null;
  min_face_width?: number | null;
  min_face_height?: number | null;
  min_face_brightness?: number | null;
  min_face_blur?: number | null;
  adaptive_frame_skip_enabled?: boolean;
  target_inference_ms?: number | null;
  max_frame_skip?: number | null;
};

type WorkerStatus = {
  camera_id?: string;
  running?: boolean;
  initializing?: boolean;
  error?: string | null;
  performance?: {
    fps?: number;
    last_face_count?: number;
    last_total_ms?: number;
    last_detection_ms?: number;
    last_recognition_ms?: number;
    quality_rejected_count?: number;
    frame_skip_current?: number;
    roi_crop_applied?: boolean;
    clahe_applied?: boolean;
  };
};

type StatusData = {
  error?: boolean | string | null;
  running?: boolean;
  runtime_ready?: boolean;
  runtime_initializing?: boolean;
  runtime_initialization_progress_percent?: number;
  runtime_initialization_stage?: string;
  running_count?: number;
  worker_count?: number;
  workers?: WorkerStatus[];
};

type ApiOptions = RequestInit & {
  headers?: HeadersInit;
};

export default function CCTVSettingsPanel() {
  const searchParams = useSearchParams();
  const urlCompanyId = searchParams.get("companyId");
  
  const [busy, setBusy] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [settingsExists, setSettingsExists] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimeInitializing, setRuntimeInitializing] = useState(false);
  const [runtimeProgress, setRuntimeProgress] = useState(0);
  const [runtimeStage, setRuntimeStage] = useState("Idle");
  
  const [statusData, setStatusData] = useState<StatusData | null>(null);

  const [companyId, setCompanyId] = useState("");
  
  // Form State
  const [cooldownSeconds, setCooldownSeconds] = useState("30");
  const [timeToleranceMinutes, setTimeToleranceMinutes] = useState("0");
  const [allowAfterTolerance, setAllowAfterTolerance] = useState(true);
  const [settingsEnabled, setSettingsEnabled] = useState(false);

  const [cameraName, setCameraName] = useState("");
  const [cameraSource, setCameraSource] = useState("");
  const [cameraZone, setCameraZone] = useState("in");
  const [roiEnabled, setRoiEnabled] = useState(false);
  const [roiPolygonText, setRoiPolygonText] = useState("");
  const [claheEnabled, setClaheEnabled] = useState(false);
  const [detectionConfidenceThreshold, setDetectionConfidenceThreshold] = useState("");
  const [recognitionSimilarityThreshold, setRecognitionSimilarityThreshold] = useState("");
  const [reidSimilarityThreshold, setReidSimilarityThreshold] = useState("");
  const [trackConfirmHits, setTrackConfirmHits] = useState("");
  const [minFaceWidth, setMinFaceWidth] = useState("");
  const [minFaceHeight, setMinFaceHeight] = useState("");
  const [minFaceBrightness, setMinFaceBrightness] = useState("");
  const [minFaceBlur, setMinFaceBlur] = useState("");
  const [adaptiveFrameSkipEnabled, setAdaptiveFrameSkipEnabled] = useState(false);
  const [targetInferenceMs, setTargetInferenceMs] = useState("");
  const [maxFrameSkip, setMaxFrameSkip] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState("New");

  const [toastMessage, setToastMessage] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roiPreviewRef = useRef<HTMLDivElement | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastMessage("");
    }, 3200);
  };

  const api = async (path: string, options: ApiOptions = {}) => {
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

  const resolveCompanyId = async (): Promise<string> => {
    try {
      const userInfoStr = localStorage.getItem("user_info");
      if (userInfoStr) {
        const user = JSON.parse(userInfoStr);
        if (user.account_type === "personal") return user.id;
        if (user.company_id) return user.company_id;
      }
    } catch {}
    
    if (urlCompanyId) return urlCompanyId;
    const saved = localStorage.getItem("cctv_company_id") || "";
    if (saved) return saved;
    try {
      const config = await api("/config");
      return config?.company_id || "";
    } catch {
      return "";
    }
  };

  const progressPercent = (value?: number) => {
    const percent = Number(value ?? 0);
    if (!Number.isFinite(percent)) return 0;
    return Math.max(0, Math.min(100, Math.round(percent)));
  };

  const formatRoiPolygon = (points?: RoiPoint[]) => {
    if (!Array.isArray(points) || points.length === 0) return "";
    return points.map((point) => `${Number(point.x).toFixed(3)},${Number(point.y).toFixed(3)}`).join("\n");
  };

  const parseRoiPolygon = () => {
    const lines = roiPolygonText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return [];
    const points = lines.map((line) => {
      const [rawX, rawY] = line.split(",").map((value) => value.trim());
      const x = Number(rawX);
      const y = Number(rawY);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        throw new Error("ROI harus berisi koordinat x,y dari 0 sampai 1.");
      }
      return { x, y };
    });
    if (roiEnabled && points.length < 3) {
      throw new Error("ROI polygon minimal 3 titik.");
    }
    return points;
  };

  const currentRoiPoints = () => {
    try {
      return parseRoiPolygon();
    } catch {
      return [];
    }
  };

  const updateRoiPoints = (points: RoiPoint[]) => {
    setRoiPolygonText(formatRoiPolygon(points));
  };

  const addRoiPointFromPreview = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!roiEnabled || busy) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const points = currentRoiPoints();
    updateRoiPoints([
      ...points,
      {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      },
    ]);
  };

  const undoRoiPoint = () => {
    const points = currentRoiPoints();
    updateRoiPoints(points.slice(0, -1));
  };

  const resetCameraOptimizationFields = () => {
    setRoiEnabled(false);
    setRoiPolygonText("");
    setClaheEnabled(false);
    setDetectionConfidenceThreshold("");
    setRecognitionSimilarityThreshold("");
    setReidSimilarityThreshold("");
    setTrackConfirmHits("");
    setMinFaceWidth("");
    setMinFaceHeight("");
    setMinFaceBrightness("");
    setMinFaceBlur("");
    setAdaptiveFrameSkipEnabled(false);
    setTargetInferenceMs("");
    setMaxFrameSkip("");
  };

  const optionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new Error("Nilai tuning harus berupa angka.");
    }
    return parsed;
  };

  const formatOptionalNumber = (value?: number | null) => (
    value === null || value === undefined ? "" : String(value)
  );

  const errorMessage = (error: unknown, fallback: string) => (
    error instanceof Error ? error.message : fallback
  );

  const loadCameras = async (cid: string, quiet = false, isReady = settingsReady) => {
    if (!cid || !isReady) {
      setCameras([]);
      return;
    }
    try {
      const data = await api(`/cameras/${encodeURIComponent(cid)}`);
      setCameras(Array.isArray(data) ? data : []);
      if (!quiet) showToast("Daftar kamera dimuat");
    } catch (error) {
      setCameras([]);
      if (!quiet) showToast(errorMessage(error, "Gagal memuat kamera"));
    }
  };

  const loadSettings = async (cid: string, quiet = false) => {
    if (!cid) {
      showToast("Company ID wajib diisi");
      return;
    }
    try {
      const settings = await api(`/settings/${encodeURIComponent(cid)}`);
      setSettingsExists(Boolean(settings.company_setting_exists));
      const ready = Boolean(settings.company_setting_exists && settings.enabled);
      setSettingsReady(ready);
      setCooldownSeconds(String(settings.cooldown_seconds ?? 30));
      setTimeToleranceMinutes(String(settings.time_tolerance_minutes ?? 0));
      setAllowAfterTolerance(settings.allow_attendance_after_tolerance !== false);
      setSettingsEnabled(Boolean(settings.enabled));
      localStorage.setItem("cctv_company_id", cid);
      if (!quiet) showToast("Settings dimuat");
      return ready;
    } catch (error) {
      setSettingsExists(false);
      setSettingsReady(false);
      if (!quiet) showToast(errorMessage(error, "Gagal memuat settings"));
      return false;
    }
  };

  const refreshStatus = useCallback(async (cid = companyId) => {
    if (!cid) return;
    try {
      const stat = await api(`/status?company_id=${encodeURIComponent(cid)}`);
      setStatusData(stat);
      setWorkers(Array.isArray(stat.workers) ? stat.workers : []);
      setRuntimeReady(Boolean(stat.runtime_ready));
      setRuntimeInitializing(Boolean(stat.runtime_initializing));
      setRuntimeProgress(progressPercent(stat.runtime_initialization_progress_percent));
      setRuntimeStage(stat.runtime_initialization_stage || "Idle");
    } catch (error) {
      setStatusData({ error: true });
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const init = async () => {
      const cid = await resolveCompanyId();
      setCompanyId(cid);
      if (cid) {
        localStorage.setItem("cctv_company_id", cid);
        const ready = await loadSettings(cid, true);
        await loadCameras(cid, true, ready);
      }
      await refreshStatus();
      if (!cancelled) interval = setInterval(refreshStatus, 2000);
    };
    init();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refreshStatus, urlCompanyId]);

  const saveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!companyId) {
      showToast("Company ID wajib diisi");
      return;
    }
    const payload = {
      enabled: settingsEnabled,
      cooldown_seconds: Number(cooldownSeconds),
      time_tolerance_minutes: Number(timeToleranceMinutes),
      allow_attendance_after_tolerance: allowAfterTolerance,
    };
    setBusy(true);
    try {
      await api(`/settings/${encodeURIComponent(companyId)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSettingsExists(true);
      setSettingsReady(payload.enabled);
      localStorage.setItem("cctv_company_id", companyId);
      showToast("Settings disimpan");
      if (payload.enabled) {
        await loadCameras(companyId, true, payload.enabled);
      }
    } catch (error) {
      showToast(errorMessage(error, "Gagal menyimpan settings"));
    } finally {
      setBusy(false);
    }
  };

  const saveCamera = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settingsReady) {
      showToast("Aktifkan Company Settings terlebih dahulu");
      return;
    }
    if (!companyId) {
      showToast("Company ID wajib diisi");
      return;
    }
    if (!cameraSource.trim()) {
      showToast("Camera source wajib diisi");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        camera_id: selectedCameraId,
        name: cameraName.trim() || "Default CCTV Camera",
        camera_source: cameraSource.trim(),
        roi_enabled: roiEnabled,
        roi_polygon: parseRoiPolygon(),
        clahe_enabled: claheEnabled,
        detection_confidence_threshold: optionalNumber(detectionConfidenceThreshold),
        recognition_similarity_threshold: optionalNumber(recognitionSimilarityThreshold),
        reid_similarity_threshold: optionalNumber(reidSimilarityThreshold),
        track_confirm_hits: optionalNumber(trackConfirmHits),
        min_face_width: optionalNumber(minFaceWidth),
        min_face_height: optionalNumber(minFaceHeight),
        min_face_brightness: optionalNumber(minFaceBrightness),
        min_face_blur: optionalNumber(minFaceBlur),
        adaptive_frame_skip_enabled: adaptiveFrameSkipEnabled,
        target_inference_ms: optionalNumber(targetInferenceMs),
        max_frame_skip: optionalNumber(maxFrameSkip),
      };
      await api(`/source/${encodeURIComponent(companyId)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast("Camera disimpan");
      await loadCameras(companyId, true, settingsReady);
      await refreshStatus();
      setShowEditor(false);
      setSelectedCameraId(null);
    } catch (error) {
      showToast(errorMessage(error, "Gagal menyimpan kamera"));
    } finally {
      setBusy(false);
    }
  };

  const deleteCamera = async (id: string, name?: string) => {
    if (!settingsReady) {
      showToast("Aktifkan Company Settings terlebih dahulu");
      return;
    }
    if (!window.confirm(`Hapus kamera "${name || "Unnamed Camera"}"?`)) return;
    setBusy(true);
    try {
      await api(`/cameras/${encodeURIComponent(companyId)}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (selectedCameraId === id) {
        setShowEditor(false);
        setSelectedCameraId(null);
      }
      showToast("Camera dihapus");
      await loadCameras(companyId, true, settingsReady);
      await refreshStatus();
    } catch (error) {
      showToast(errorMessage(error, "Gagal menghapus kamera"));
    } finally {
      setBusy(false);
    }
  };

  const workerById = (id: string) => workers.find((w) => w.camera_id === id) || null;

  const getWorkerPill = () => {
    if (!statusData) return { running: false, error: false, label: "Checking" };
    const r = Boolean((statusData.running || statusData.runtime_ready) && !statusData.error);
    const err = Boolean(statusData.error);
    let lbl = "Stopped";
    if (statusData.error) lbl = "Error";
    else if (statusData.running) lbl = `Running ${statusData.running_count || 0}/${statusData.worker_count || 0}`;
    else if (statusData.runtime_initializing) lbl = `Preparing ${runtimeProgress}%`;
    else if (statusData.runtime_ready) lbl = "Runtime Ready";
    return { running: r, error: err, label: lbl };
  };
  const pill = getWorkerPill();

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });
  };

  const cameraForSlot = (slot: string) => {
    const aliases = slot === "out" ? ["out", "exit", "checkout", "check-out", "attendance_out"] : ["in", "attendance"];
    return cameras.find((cam) => aliases.includes((cam.zone_type || "").toLowerCase())) || null;
  };

  const renderCameraSlot = (slot: string) => {
    const cam = cameraForSlot(slot);
    const isOut = slot === "out";
    const title = isOut ? "Kamera Keluar" : "Kamera Masuk";
    const subtitle = isOut ? "Mengisi time_out" : "Mengisi time_in";
    const Icon = isOut ? LogOut : LogIn;
    const worker = cam ? workerById(cam.id) : null;
    const performance = worker?.performance;
    const status = worker?.running ? "Running" : worker?.initializing ? "Starting" : worker?.error ? "Error" : "Stopped";
    const selected = cam && selectedCameraId === cam.id;

    if (!cam) {
      return (
        <div className={`p-5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-5 ${!settingsReady ? 'opacity-50' : ''}`}>
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
              <Icon size={18} className="text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="h-20 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
            Belum ada kamera
          </div>
          <button 
            className="w-full py-2 flex justify-center items-center gap-2 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition-colors font-medium text-sm disabled:opacity-50"
            type="button" 
            disabled={!settingsReady || busy} 
            onClick={() => {
              setSelectedCameraId(null);
              setCameraName("");
              setCameraSource("");
              setCameraZone(slot);
              resetCameraOptimizationFields();
              setEditorMode("New");
              setShowEditor(true);
            }}
          >
            <Plus size={16} />
            <span>Setup {isOut ? "Out" : "In"}</span>
          </button>
        </div>
      );
    }

    return (
      <div className={`p-5 bg-slate-50 border rounded-xl flex flex-col gap-5 transition-colors ${selected ? "border-indigo-500 bg-indigo-500/5" : "border-slate-100 hover:border-slate-200"}`}>
        <div className="flex gap-4 justify-between">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
              <Icon size={18} className="text-slate-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <span className={`px-2 py-1 h-fit text-[10px] font-bold uppercase tracking-wider rounded-md border ${worker?.running ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : worker?.error ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
            {status}
          </span>
        </div>
        
        <div className="p-4 bg-white border border-slate-100 rounded-xl">
          <strong className="block text-sm text-slate-900 mb-1">{cam.name || "Unnamed Camera"}</strong>
          <small className="block text-xs text-slate-500 break-all">{cam.camera_source || "-"}</small>
          <div className="mt-3 flex flex-wrap gap-2">
            {cam.roi_enabled && <span className="px-2 py-1 bg-cyan-50 text-cyan-700 border border-cyan-100 rounded-md text-[11px] font-medium">ROI</span>}
            {cam.clahe_enabled && <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-md text-[11px] font-medium">CLAHE</span>}
          </div>
          {performance && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
              <span>{(performance.fps || 0).toFixed(1)} FPS</span>
              <span>{Math.round(performance.last_total_ms || 0)} ms</span>
              <span>{performance.last_face_count || 0} face</span>
              <span>{performance.quality_rejected_count || 0} reject</span>
              <span>skip {performance.frame_skip_current || 0}</span>
              <span>{performance.clahe_applied ? "CLAHE on" : "CLAHE off"}</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <button 
            className="py-2 flex justify-center items-center gap-2 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors font-medium text-sm disabled:opacity-50"
            type="button" 
            disabled={!settingsReady || busy} 
            onClick={() => {
              setSelectedCameraId(cam.id);
              setCameraName(cam.name || "");
              setCameraSource(cam.camera_source || "");
              setCameraZone(cam.zone_type || "in");
              setRoiEnabled(Boolean(cam.roi_enabled));
              setRoiPolygonText(formatRoiPolygon(cam.roi_polygon));
              setClaheEnabled(Boolean(cam.clahe_enabled));
              setDetectionConfidenceThreshold(formatOptionalNumber(cam.detection_confidence_threshold));
              setRecognitionSimilarityThreshold(formatOptionalNumber(cam.recognition_similarity_threshold));
              setReidSimilarityThreshold(formatOptionalNumber(cam.reid_similarity_threshold));
              setTrackConfirmHits(formatOptionalNumber(cam.track_confirm_hits));
              setMinFaceWidth(formatOptionalNumber(cam.min_face_width));
              setMinFaceHeight(formatOptionalNumber(cam.min_face_height));
              setMinFaceBrightness(formatOptionalNumber(cam.min_face_brightness));
              setMinFaceBlur(formatOptionalNumber(cam.min_face_blur));
              setAdaptiveFrameSkipEnabled(Boolean(cam.adaptive_frame_skip_enabled));
              setTargetInferenceMs(formatOptionalNumber(cam.target_inference_ms));
              setMaxFrameSkip(formatOptionalNumber(cam.max_frame_skip));
              setEditorMode("Edit");
              setShowEditor(true);
            }}
          >
            <Pencil size={16} />
            <span>Edit</span>
          </button>
          <button 
            className="py-2 flex justify-center items-center gap-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors font-medium text-sm disabled:opacity-50"
            type="button" 
            disabled={!settingsReady || busy} 
            onClick={() => deleteCamera(cam.id, cam.name)}
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    );
  };

  const roiEditorPoints = currentRoiPoints();
  const roiPreviewUrl = selectedCameraId && companyId ? `${API_BASE}/stream?camera_id=${encodeURIComponent(selectedCameraId)}&company_id=${encodeURIComponent(companyId)}` : "";

  return (
    <div className="text-slate-900 font-sans selection:bg-indigo-500/30">
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-7 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-col">
          
          <h2 className="text-lg font-semibold tracking-tight">Konfigurasi Kamera CCTV</h2><p className="mt-2 text-sm text-slate-500">Atur sumber kamera.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            <span className={`w-2 h-2 rounded-full ${pill.running ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : pill.error ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"}`} />
            <span className="text-slate-700 font-medium">{pill.label}</span>
          </div>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Right Column - Cameras */}
        <div className="xl:col-span-12">
          <section className={`bg-white backdrop-blur-md border border-slate-100 rounded-xl overflow-hidden shadow-sm transition-opacity ${!settingsReady ? "opacity-60" : ""}`}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-slate-900">CCTV Cameras</h2>
                <p className="text-sm text-slate-500">Atur kamera yang akan digunakan untuk monitoring pengunjung.</p>
              </div>
              <div className="flex gap-2 shrink-0 ml-4">
                <button 
                  className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 text-slate-500 hover:text-slate-900"
                  type="button" 
                  title="Load cameras" 
                  disabled={!settingsReady || busy} 
                  onClick={() => loadCameras(companyId)}
                >
                  <RefreshCw size={16} />
                </button>
                <button 
                  className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 text-slate-500 hover:text-slate-900"
                  type="button" 
                  title="Clear form" 
                  disabled={!settingsReady || busy} 
                  onClick={() => {
                    setShowEditor(false);
                    setSelectedCameraId(null);
                    setCameraName("");
                    setCameraSource("");
                    setCameraZone("in");
                    resetCameraOptimizationFields();
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {!settingsReady && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 text-amber-500 text-sm font-medium mb-6">
                  <Lock size={18} className="shrink-0 mt-0.5" />
                  <span>Aktifkan Company Settings terlebih dahulu untuk mengatur kamera.</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderCameraSlot("in")}
                {renderCameraSlot("out")}
              </div>

              <AnimatePresence>
                {showEditor && settingsReady && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="p-6 bg-slate-50 border border-indigo-500/30 rounded-xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                    
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-medium text-slate-900">{editorMode === "Edit" ? "Edit Kamera" : "Tambah Kamera"}</h3>
                        <p className="text-sm text-slate-500 mt-1">{editorMode === "Edit" ? "Perubahan akan memperbarui kamera yang dipilih." : "Isi source kamera untuk slot yang dipilih."}</p>
                      </div>
                      <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 rounded-lg text-xs font-bold uppercase tracking-wider">
                        {editorMode}
                      </span>
                    </div>

                    <form onSubmit={saveCamera} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Camera Name</span>
                          <input 
                            type="text" autoComplete="off" placeholder="Lobby Entrance" 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-500"
                            value={cameraName} onChange={(e) => setCameraName(e.target.value)} disabled={busy} 
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Zone Type</span>
                          <select 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow appearance-none"
                            value={cameraZone} onChange={(e) => setCameraZone(e.target.value)} disabled={busy}
                          >
                            <option value="in">In</option>
                            <option value="out">Out</option>
                          </select>
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-slate-500">
                        <span className="block mb-2">Webcam Index / RTSP URL</span>
                        <input 
                          type="text" autoComplete="off" placeholder="0 atau rtsp://user:pass@host:554/stream" 
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-500 font-mono text-sm mb-2"
                          value={cameraSource} onChange={(e) => setCameraSource(e.target.value)} disabled={busy} 
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Quick Test:</span>
                          <button 
                            type="button"
                            onClick={() => setCameraSource("0")}
                            className="text-[11px] px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition-colors"
                          >
                            Webcam (0)
                          </button>
                          <button 
                            type="button"
                            onClick={() => setCameraSource("./samples/sample_faces.mp4")}
                            className="text-[11px] px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition-colors"
                          >
                            Sample Video
                          </button>
                          <button 
                            type="button"
                            onClick={() => setCameraSource("https://github.com/intel-iot-devkit/sample-videos/raw/master/face-demographics-walking.mp4")}
                            className="text-[11px] px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition-colors"
                          >
                            Sample URL
                          </button>
                        </div>
                      </label>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" checked={roiEnabled} onChange={(e) => setRoiEnabled(e.target.checked)} disabled={busy} />
                          <span className="text-sm font-medium text-slate-700">Polygon ROI</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" checked={claheEnabled} onChange={(e) => setClaheEnabled(e.target.checked)} disabled={busy} />
                          <span className="text-sm font-medium text-slate-700">CLAHE Malam</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Detection Threshold</span>
                          <input type="number" min="0" max="1" step="0.01" placeholder="global" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={detectionConfidenceThreshold} onChange={(e) => setDetectionConfidenceThreshold(e.target.value)} disabled={busy} />
                        </label>
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Recognition Threshold</span>
                          <input type="number" min="0" max="1" step="0.01" placeholder="global" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={recognitionSimilarityThreshold} onChange={(e) => setRecognitionSimilarityThreshold(e.target.value)} disabled={busy} />
                        </label>
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Re-ID Threshold</span>
                          <input type="number" min="0" max="1" step="0.01" placeholder="global" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={reidSimilarityThreshold} onChange={(e) => setReidSimilarityThreshold(e.target.value)} disabled={busy} />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Confirm Hits</span>
                          <input type="number" min="1" step="1" placeholder="global" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={trackConfirmHits} onChange={(e) => setTrackConfirmHits(e.target.value)} disabled={busy} />
                        </label>
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Min Face W</span>
                          <input type="number" min="1" step="1" placeholder="32" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={minFaceWidth} onChange={(e) => setMinFaceWidth(e.target.value)} disabled={busy} />
                        </label>
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Min Face H</span>
                          <input type="number" min="1" step="1" placeholder="32" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={minFaceHeight} onChange={(e) => setMinFaceHeight(e.target.value)} disabled={busy} />
                        </label>
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Min Blur</span>
                          <input type="number" min="0" step="1" placeholder="18" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={minFaceBlur} onChange={(e) => setMinFaceBlur(e.target.value)} disabled={busy} />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Min Brightness</span>
                          <input type="number" min="0" max="255" step="1" placeholder="28" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={minFaceBrightness} onChange={(e) => setMinFaceBrightness(e.target.value)} disabled={busy} />
                        </label>
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Target Inference ms</span>
                          <input type="number" min="1" step="1" placeholder="120" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={targetInferenceMs} onChange={(e) => setTargetInferenceMs(e.target.value)} disabled={busy || !adaptiveFrameSkipEnabled} />
                        </label>
                        <label className="block text-sm font-medium text-slate-500">
                          <span className="block mb-2">Max Frame Skip</span>
                          <input type="number" min="0" max="10" step="1" placeholder="3" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400" value={maxFrameSkip} onChange={(e) => setMaxFrameSkip(e.target.value)} disabled={busy || !adaptiveFrameSkipEnabled} />
                        </label>
                      </div>

                      <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" checked={adaptiveFrameSkipEnabled} onChange={(e) => setAdaptiveFrameSkipEnabled(e.target.checked)} disabled={busy} />
                        <span className="text-sm font-medium text-slate-700">Adaptive Frame Skip</span>
                      </label>

                      <label className="block text-sm font-medium text-slate-500">
                        <span className="mb-2 flex items-center gap-2">
                          <ScanLine size={16} />
                          ROI Polygon
                        </span>
                        <div
                          ref={roiPreviewRef}
                          role="button"
                          tabIndex={0}
                          onClick={addRoiPointFromPreview}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              setRoiEnabled(true);
                            }
                          }}
                          className={`relative mb-3 aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 ${roiEnabled ? "cursor-crosshair" : "cursor-default opacity-70"}`}
                        >
                          {roiPreviewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={roiPreviewUrl}
                              alt="ROI preview"
                              className="h-full w-full object-fill"
                            />
                          ) : (
                            <div className="absolute inset-0 grid place-items-center text-xs font-medium text-slate-400">
                              Preview ROI
                            </div>
                          )}
                          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {roiEditorPoints.length >= 3 && (
                              <polygon
                                points={roiEditorPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
                                fill="rgba(34, 211, 238, 0.18)"
                                stroke="rgb(34, 211, 238)"
                                strokeWidth="0.7"
                              />
                            )}
                            {roiEditorPoints.length === 2 && (
                              <line
                                x1={roiEditorPoints[0].x * 100}
                                y1={roiEditorPoints[0].y * 100}
                                x2={roiEditorPoints[1].x * 100}
                                y2={roiEditorPoints[1].y * 100}
                                stroke="rgb(34, 211, 238)"
                                strokeWidth="0.7"
                              />
                            )}
                            {roiEditorPoints.map((point, index) => (
                              <circle
                                key={`${point.x}-${point.y}-${index}`}
                                cx={point.x * 100}
                                cy={point.y * 100}
                                r="1.3"
                                fill="white"
                                stroke="rgb(8, 145, 178)"
                                strokeWidth="0.5"
                              />
                            ))}
                          </svg>
                        </div>
                        <textarea
                          rows={5}
                          placeholder={"0.250,0.200\n0.750,0.200\n0.750,0.900\n0.250,0.900"}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow placeholder:text-slate-400 font-mono text-sm disabled:opacity-60"
                          value={roiPolygonText}
                          onChange={(e) => setRoiPolygonText(e.target.value)}
                          disabled={busy || !roiEnabled}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRoiEnabled(true);
                              setRoiPolygonText("0.250,0.180\n0.750,0.180\n0.820,0.920\n0.180,0.920");
                            }}
                            className="text-[11px] px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition-colors"
                          >
                            Area Pintu
                          </button>
                          <button
                            type="button"
                            onClick={() => setRoiPolygonText("")}
                            className="text-[11px] px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition-colors"
                          >
                            Clear ROI
                          </button>
                          <button
                            type="button"
                            onClick={undoRoiPoint}
                            className="text-[11px] px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition-colors disabled:opacity-50"
                            disabled={!roiEditorPoints.length}
                          >
                            Undo Point
                          </button>
                        </div>
                      </label>
                      
                      <div className="pt-2">
                        <button 
                          className="w-full py-3 flex justify-center items-center gap-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                          type="submit" disabled={busy}
                        >
                          <Save size={18} />
                          <span>Save Camera</span>
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>

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
