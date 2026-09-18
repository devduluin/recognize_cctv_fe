"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Square } from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/events";

export default function CameraTestPreview({ source, position, orientation, reversed }: {
  source: string; position: number; orientation: string; reversed: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const active = useRef<AbortController | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  const stopPreview = () => {
    active.current?.abort();
    active.current = null;
    setStreaming(false);
    setTesting(false);
    setPreview(false);
  };

  const testCamera = async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStreaming(true);
    setTesting(true);
    setError("");
    setPreview(false);
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout>;
    const armTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { timedOut = true; controller.abort(); }, 18000);
    };
    armTimeout();
    try {
      let companyId: string | undefined;
      try {
        const user = JSON.parse(localStorage.getItem("user_info") || "null");
        companyId = user?.account_type === "personal" ? user?.id : user?.company_id;
      } catch { /* An explicit source can be tested without company defaults. */ }
      const response = await fetch(`${API_BASE}/camera-stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera_source: source.trim() || null, company_id: companyId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(typeof payload?.detail === "string" ? payload.detail : "Kamera belum dapat diuji. Coba lagi.");
      }
      if (!response.body || !response.headers.get("content-type")?.includes("application/x-camera-frames")) throw new Error("Video preview tidak tersedia.");
      const reader = response.body.getReader();
      let pending = new Uint8Array(0);
      try {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) throw new Error("Streaming kamera terputus. Klik Test Kamera untuk menghubungkan kembali.");
          const merged = new Uint8Array(pending.length + value.length);
          merged.set(pending); merged.set(value, pending.length); pending = merged;
          while (pending.length >= 4) {
            const size = new DataView(pending.buffer, pending.byteOffset, 4).getUint32(0);
            if (!size || size > 8 * 1024 * 1024) throw new Error("Frame kamera tidak valid.");
            if (pending.length < size + 4) break;
            const jpeg = pending.slice(4, size + 4);
            pending = pending.slice(size + 4);
            const bitmap = await createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }));
            try {
              if (controller.signal.aborted) return;
              const target = canvas.current;
              if (!target) return;
              if (target.width !== bitmap.width) target.width = bitmap.width;
              if (target.height !== bitmap.height) target.height = bitmap.height;
              target.getContext("2d")?.drawImage(bitmap, 0, 0);
              setPreview(true); setTesting(false); armTimeout();
            } finally { bitmap.close(); }
          }
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } catch (error) {
      if (active.current === controller && (!controller.signal.aborted || timedOut)) setError(timedOut ? "Kamera tidak merespons. Coba lagi." : error instanceof Error ? error.message : "Streaming kamera gagal.");
    } finally {
      clearTimeout(timer!);
      if (active.current === controller) {
        controller.abort(); active.current = null;
        setStreaming(false); setTesting(false); setPreview(false);
      }
    }
  };

  const arrow = orientation === "horizontal" ? reversed ? "↑" : "↓" : reversed ? "←" : "→";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold">Preview Kamera</p><p className="mt-1 text-xs text-slate-500">Video live untuk mengatur garis hitung sebelum event dimulai.</p></div>
        <button type="button" onClick={streaming ? stopPreview : testCamera} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50">
          {testing ? <Loader2 size={16} className="animate-spin" /> : streaming ? <Square size={16} /> : <Camera size={16} />}{streaming ? "Hentikan Preview" : "Test Kamera"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <div className={preview ? "relative" : "hidden"}>
          <canvas ref={canvas} aria-label="Video live kamera event" className="block h-auto w-full" />
          <div aria-label={`Garis ${orientation}, posisi ${position} persen, masuk ${arrow}`} className={`pointer-events-none absolute bg-amber-400 shadow-sm ${orientation === "horizontal" ? "left-0 h-0.5 w-full" : "top-0 h-full w-0.5"}`} style={orientation === "horizontal" ? { top: `${position}%` } : { left: `${position}%` }}>
            <span className={`absolute whitespace-nowrap rounded bg-amber-400 px-2 py-1 text-[10px] font-bold text-slate-950 ${orientation === "horizontal" ? "right-2 bottom-1" : "left-1 top-2"}`}>MASUK {arrow}</span>
          </div>
        </div>
        {!preview && <div role="status" className="flex min-h-40 flex-col items-center justify-center gap-3 px-5 py-8 text-center text-slate-400"><Camera size={28} strokeWidth={1.5} /><p className="text-xs">{testing ? "Menghubungkan kamera…" : "Klik Test Kamera untuk melihat sumber kamera ini."}</p></div>}
      </div>
      {preview && <p role="status" className="text-xs text-emerald-700">Live preview aktif. Garis mengikuti pengaturan di atas; pengunjung tidak dihitung.</p>}
    </div>
  );
}
