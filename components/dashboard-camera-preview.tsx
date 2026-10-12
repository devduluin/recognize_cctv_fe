"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Video,
} from "lucide-react";
import { Button, ButtonLink } from "./ui/button";
import { getAuthHeaders } from "./auth/auth-api";
import { cx, ui } from "./ui/styles";

type CCTVCamera = {
  id: string;
  name: string;
  rtsp_url?: string;
  camera_source?: string;
  status?: string;
  last_used?: string;
  events?: string[];
  zone_type?: string;
};

const CCTV_API = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/cctv`;
const EVENTS_API = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/events`;

function resolveCompanyId(companyId?: string) {
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

function DashboardCameraCard({
  camera,
  companyId,
}: {
  camera: CCTVCamera;
  companyId: string;
}) {
  const [streaming, setStreaming] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
    setConnecting(false);
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    const source = (camera.rtsp_url || camera.camera_source || "").trim();
    if (!source) {
      setError("Sumber RTSP / URL kamera belum disetel.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setConnecting(true);
    setError("");

    let timedOut = false;
    let timer: ReturnType<typeof setTimeout>;
    const armTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 12000);
    };
    armTimeout();

    try {
      const response = await fetch(`${EVENTS_API}/camera-stream`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          camera_source: source,
          company_id: companyId || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          typeof payload?.detail === "string"
            ? payload.detail
            : "Kamera tidak dapat dihubungkan. Pastikan kamera online.",
        );
      }

      if (!response.body) {
        throw new Error("Video stream tidak tersedia.");
      }

      const reader = response.body.getReader();
      let pending = new Uint8Array(0);

      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) throw new Error("Streaming kamera terputus.");

        const merged = new Uint8Array(pending.length + value.length);
        merged.set(pending);
        merged.set(value, pending.length);
        pending = merged;

        while (pending.length >= 4) {
          const size = new DataView(
            pending.buffer,
            pending.byteOffset,
            4,
          ).getUint32(0);
          if (!size || size > 8 * 1024 * 1024) {
            throw new Error("Frame kamera tidak valid.");
          }
          if (pending.length < size + 4) break;

          const jpeg = pending.slice(4, size + 4);
          pending = pending.slice(size + 4);
          const bitmap = await createImageBitmap(
            new Blob([jpeg], { type: "image/jpeg" }),
          );

          try {
            if (controller.signal.aborted) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
            if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
            canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
            setStreaming(true);
            setConnecting(false);
            armTimeout();
          } finally {
            bitmap.close();
          }
        }
      }
    } catch (err) {
      if (abortRef.current === controller && (!controller.signal.aborted || timedOut)) {
        setError(
          timedOut
            ? "Kamera tidak merespons (timeout). Pastikan RTSP aktif."
            : err instanceof Error
              ? err.message
              : "Gagal menghubungkan ke kamera.",
        );
      }
    } finally {
      clearTimeout(timer!);
      if (abortRef.current === controller) {
        controller.abort();
        abortRef.current = null;
        setStreaming(false);
        setConnecting(false);
      }
    }
  }, [camera, companyId, stopStream]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-white p-4 shadow-[0_1px_3px_#14264114] transition-all hover:border-slate-300 hover:shadow-md">
      {/* Header Card */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900" title={camera.name}>
            {camera.name || "Kamera CCTV"}
          </h3>
          <p className="truncate text-[11px] text-muted" title={camera.rtsp_url || camera.camera_source || "-"}>
            {camera.rtsp_url || camera.camera_source || "Sumber belum disetel"}
          </p>
        </div>
        <span
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            streaming
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : connecting
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-slate-100 text-slate-600 border border-slate-200",
          )}
        >
          <span
            className={cx(
              "size-1.5 rounded-full",
              streaming
                ? "bg-emerald-500 animate-pulse"
                : connecting
                  ? "bg-amber-500 animate-spin"
                  : "bg-slate-400",
            )}
          />
          {streaming ? "LIVE" : connecting ? "CONNECTING" : "STANDBY"}
        </span>
      </div>

      {/* Video Preview Canvas / Placeholder Area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center">
        {/* Canvas untuk frame video */}
        <canvas
          ref={canvasRef}
          className={cx("absolute inset-0 size-full object-contain", streaming ? "block" : "hidden")}
        />

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-x-2 top-2 z-10 rounded-lg bg-rose-950/90 border border-rose-800 p-2.5 text-center text-xs text-rose-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={startStream}
              className="mt-1.5 inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[11px] text-rose-100 hover:bg-white/20 transition-colors cursor-pointer"
            >
              <RefreshCw size={11} />
              Coba Lagi
            </button>
          </div>
        )}

        {/* Connecting state */}
        {connecting && (
          <div className="flex flex-col items-center justify-center p-4 text-center text-slate-300">
            <Loader2 size={24} className="mb-2 animate-spin text-blue-400" />
            <p className="text-xs font-medium">Menghubungkan ke kamera...</p>
          </div>
        )}

        {/* Standby placeholder with direct trigger button */}
        {!streaming && !connecting && (
          <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400">
            <div className="mb-2.5 flex size-12 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-400">
              <Camera size={24} strokeWidth={1.5} />
            </div>
            <p className="text-xs font-medium text-slate-200">Kamera Standby</p>
            <button
              type="button"
              onClick={startStream}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Play size={13} fill="currentColor" />
              Nyalakan Stream
            </button>
          </div>
        )}

        {/* Overlay zone badge if available */}
        {camera.zone_type && (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-slate-200 backdrop-blur-xs">
            {camera.zone_type}
          </span>
        )}
      </div>

      {/* Footer Card with trigger action */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <div>
          {streaming ? (
            <button
              type="button"
              onClick={stopStream}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <Square size={11} fill="currentColor" />
              Hentikan Stream
            </button>
          ) : (
            <button
              type="button"
              onClick={startStream}
              disabled={connecting}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Play size={11} fill="currentColor" />
              Nyalakan Stream
            </button>
          )}
        </div>
        <Link
          href="/master-cctv"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-navy hover:underline"
        >
          Kelola Kamera
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

export default function DashboardCameraPreview({
  companyId = "",
}: {
  companyId?: string;
}) {
  const [cameras, setCameras] = useState<CCTVCamera[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const effectiveCompanyId = resolveCompanyId(companyId);

  useEffect(() => {
    if (!effectiveCompanyId) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");

      fetch(`${CCTV_API}/cameras/${encodeURIComponent(effectiveCompanyId)}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: getAuthHeaders(),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Gagal memuat preview kamera.");
          }
          return response.json();
        })
        .then((payload) => {
          if (!controller.signal.aborted) {
            setCameras(Array.isArray(payload.result) ? payload.result : []);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : "Tidak dapat memuat kamera.");
            setLoading(false);
          }
        });
    }, 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [effectiveCompanyId, reloadKey]);

  // Maksimal 3 kamera untuk preview di dashboard
  const previewCameras = cameras.slice(0, 3);

  return (
    <section className="mb-9">
      <div className={ui.sectionHeading}>
        <div>
          <h2>Preview Kamera CCTV</h2>
          <p className={ui.pageDescription}>
            Pantau kamera CCTV aktif secara langsung dari dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            icon
            aria-label="Muat ulang preview kamera"
            disabled={loading}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
          <ButtonLink variant="outline" href="/master-cctv">
            Lihat Semua Kamera ({cameras.length})
            <ArrowRight size={15} />
          </ButtonLink>
        </div>
      </div>

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="animate-pulse rounded-2xl border border-line bg-white p-4 shadow-xs"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-4 w-12 rounded-full bg-slate-200" />
              </div>
              <div className="aspect-video w-full rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      ) : previewCameras.length === 0 ? (
        <div
          role="status"
          className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
        >
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Video size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            Belum ada kamera terdaftar
          </h3>
          <p className="mt-1 max-w-md text-xs text-muted">
            Tambahkan kamera CCTV di menu Master Kamera untuk memantau streaming dan deteksi event secara langsung.
          </p>
          <ButtonLink variant="primary" href="/master-cctv" className="mt-4">
            Kelola Kamera
          </ButtonLink>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {previewCameras.map((camera) => (
            <DashboardCameraCard
              key={camera.id}
              camera={camera}
              companyId={effectiveCompanyId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
