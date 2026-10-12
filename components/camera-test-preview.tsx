"use client";
import { visitorFetch } from "./auth/visitor-api";
import { Button } from "./ui/button";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Square } from "lucide-react";
import { getAuthHeaders } from "./auth/auth-api";
import WebRTCPlayer, { StreamUrls } from "./camera/webrtc-player";
import CountingLineOverlay from "./camera/counting-line-overlay";
import { containedVideoRect, countingLineGeometry, countingLineGuidance } from "./camera/counting-line-geometry";

const API_BASE =
  (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/events";

export default function CameraTestPreview({
  source,
  position,
  orientation,
  angle = 0,
  reversed,
  countingDirection = "auto",
  twoLineCounting = true,
  zoneWidthRatio = 0.20,
  mirror = false,
  autoStart = false,
  hideLineUI = false,
  compact = false,
}: {
  source: string;
  position: number;
  orientation: string;
  angle?: number;
  reversed: boolean;
  countingDirection?: "auto" | "in" | "out";
  twoLineCounting?: boolean;
  zoneWidthRatio?: number;
  mirror?: boolean;
  autoStart?: boolean;
  hideLineUI?: boolean;
  compact?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 1920, height: 1080 });
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamUrls, setStreamUrls] = useState<StreamUrls | null>(null);
  const active = useRef<AbortController | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const videoArea = useRef<HTMLDivElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const target = videoArea.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDisplaySize({ width, height });
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );

  const stopPreview = () => {
    active.current?.abort();
    active.current = null;
    setStreaming(false);
    setTesting(false);
    setPreview(false);
    setStreamUrls(null);
  };

  const testCamera = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStreaming(true);
    setTesting(true);
    setError("");
    setPreview(false);
    setStreamUrls(null);
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
      let companyId: string | undefined;
      try {
        const user = JSON.parse(localStorage.getItem("user_info") || "null");
        companyId =
          user?.account_type === "personal" ? user?.id : user?.company_id;
      } catch {
        /* An explicit source can be tested without company defaults. */
      }
      // 1. Try MediaMTX WebRTC Preview First (Zero latency, no Python CPU load)
      try {
        const previewUrlResp = await fetch(`${API_BASE}/camera-preview-url`, {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            camera_source: source.trim() || null,
            company_id: companyId,
          }),
          signal: controller.signal,
        });
        if (previewUrlResp.ok) {
          const payload = await previewUrlResp.json().catch(() => null);
          const urls = payload?.result?.stream_urls;
          if (urls?.webrtc_whep && !controller.signal.aborted) {
            clearTimeout(timer!);
            active.current = null;
            setStreamUrls(urls);
            setPreview(true);
            setTesting(false);
            setStreaming(true);
            return;
          }
        }
      } catch {
        if (controller.signal.aborted) return;
      }

      // 2. Fallback to /camera-stream (raw frame streaming over HTTP)
      const response = await visitorFetch(`${API_BASE}/camera-stream`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          camera_source: source.trim() || null,
          company_id: companyId,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          typeof payload?.detail === "string"
            ? payload.detail
            : typeof payload?.message === "string"
              ? payload.message
              : "Kamera belum dapat diuji. Coba lagi.",
        );
      }
      if (
        !response.body ||
        !response.headers
          .get("content-type")
          ?.includes("application/x-camera-frames")
      )
        throw new Error("Video preview tidak tersedia.");
      const reader = response.body.getReader();
      let pending = new Uint8Array(0);
      try {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done)
            throw new Error(
              "Streaming kamera terputus. Klik Test Kamera untuk menghubungkan kembali.",
            );
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
            if (!size || size > 8 * 1024 * 1024)
              throw new Error("Frame kamera tidak valid.");
            if (pending.length < size + 4) break;
            const jpeg = pending.slice(4, size + 4);
            pending = pending.slice(size + 4);
            const bitmap = await createImageBitmap(
              new Blob([jpeg], { type: "image/jpeg" }),
            );
            try {
              if (controller.signal.aborted) return;
              const target = canvas.current;
              if (!target) return;
              if (target.width !== bitmap.width) target.width = bitmap.width;
              if (target.height !== bitmap.height)
                target.height = bitmap.height;
              target.getContext("2d")?.drawImage(bitmap, 0, 0);
              const width = bitmap.width, height = bitmap.height;
              setFrameSize((size) => size.width === width && size.height === height
                ? size : { width, height });
              setPreview(true);
              setTesting(false);
              armTimeout();
            } finally {
              bitmap.close();
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch (error) {
      if (
        active.current === controller &&
        (!controller.signal.aborted || timedOut)
      )
        setError(
          timedOut
            ? "Kamera tidak merespons. Coba lagi."
            : error instanceof Error
              ? error.message
              : "Streaming kamera gagal.",
        );
    } finally {
      clearTimeout(timer!);
      if (active.current === controller) {
        controller.abort();
        active.current = null;
        setStreaming(false);
        setTesting(false);
        setPreview(false);
        setStreamUrls(null);
      }
    }
  }, [source]);

  useEffect(() => {
    if (!autoStart) return;
    const initial = setTimeout(testCamera, 0);
    return () => {
      clearTimeout(initial);
      active.current?.abort();
    };
  }, [autoStart, testCamera]);

  const geometry = countingLineGeometry(frameSize.width, frameSize.height, {
    linePosition: position / 100, lineOrientation: orientation, lineAngle: angle,
    twoLineCounting, zoneWidthRatio, reverseDirection: reversed,
  });
  const directionGuidance = countingLineGuidance({
    countingDirection, twoLineCounting, reverseDirection: reversed,
  });
  const videoRect = containedVideoRect(
    displaySize.width, displaySize.height, frameSize.width, frameSize.height,
  );
  return (
    <div
      data-compact={compact}
      className="group/preview relative flex w-full flex-col overflow-hidden rounded-xl border border-dashed border-navy bg-[#edf1f7] max-[600px]:[&_button]:min-h-11"
    >
      {/* Top Overlay for Errors */}
      {error && (
        <div
          role="alert"
          className="absolute left-0 top-0 z-20 w-full bg-red-50 px-4 py-2.5 text-center text-xs font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {/* Video Area */}
      <div ref={videoArea} className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-[#080d18]">
        {streaming && streamUrls?.webrtc_whep ? (
          <WebRTCPlayer
            whepUrl={streamUrls.webrtc_whep}
            hlsUrl={streamUrls.hls}
            cameraName="Preview Kamera"
            autoPlay
            muted
            className="absolute inset-0 h-full w-full"
            lineConfig={
              hideLineUI
                ? undefined
                : {
                    linePosition: position / 100,
                    lineAngle: angle,
                    countingDirection,
                    lineOrientation: orientation as "vertical" | "horizontal",
                    reverseDirection: reversed,
                    twoLineCounting,
                    zoneWidthRatio,
                    mirror,
                  }
            }
            onStatusChange={(st) => {
              if (st === "live") {
                setPreview(true);
                setTesting(false);
              } else if (st === "error") {
                setError("Koneksi WebRTC gagal");
              }
            }}
          />
        ) : (
          <canvas
            ref={canvas}
            aria-label="Video live kamera event"
            className={`absolute inset-0 h-full w-full object-contain ${preview ? "" : "invisible"} ${mirror ? "-scale-x-100" : ""}`}
          />
        )}

        {preview && !streamUrls?.webrtc_whep && !hideLineUI && videoRect && (
          <div
            className="pointer-events-none absolute"
            style={{ left: videoRect.left, top: videoRect.top, width: videoRect.width, height: videoRect.height }}
          >
            <CountingLineOverlay
              mediaWidth={frameSize.width}
              mediaHeight={frameSize.height}
              displayWidth={videoRect.width}
              config={{
                linePosition: position / 100,
                lineOrientation: orientation,
                lineAngle: angle,
                reverseDirection: reversed,
                countingDirection,
                twoLineCounting,
                zoneWidthRatio,
                mirror,
              }}
            />
          </div>
        )}

        {!streaming && (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
            {testing ? (
              <>
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-slate-300" />
                </div>
                <p role="status" className="text-xs font-medium text-slate-300">
                  Menghubungkan...
                </p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center text-slate-300">
                  <Camera size={34} />
                </div>
                <p className="text-lg font-semibold text-slate-200">
                  Preview Kamera
                </p>
              </>
            )}
          </div>
        )}

        {/* Status Badge (Top Right) - only shown when not using WebRTCPlayer which has its own badge */}
        {!streamUrls?.webrtc_whep && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md">
            {preview ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                <span className="text-[10px] font-bold tracking-wider text-white">
                  LIVE
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                <span className="text-[10px] font-bold tracking-wider text-slate-300">
                  OFFLINE
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {!hideLineUI && (
        <div className="space-y-2 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <div aria-live="polite" aria-atomic="true" className="space-y-1">
            <p className="font-medium text-slate-900">Arah yang dihitung</p>
            {directionGuidance.map((instruction) => (
              <p key={instruction}>
                <span aria-hidden="true" className="mr-2 font-semibold">{instruction.startsWith("Masuk") ? geometry.entryArrow : geometry.exitArrow}</span>
                {instruction}
              </p>
            ))}
            <p className="text-xs text-slate-600">Balik arah perlintasan: {reversed ? "aktif" : "nonaktif"}.</p>
          </div>
          <p className="text-xs leading-5 text-slate-600">
            Centang atau hapus centang “Balik arah perlintasan” agar panah mengikuti arah berjalan yang ingin dihitung.
            {countingDirection !== "auto" && " Gerakan ke arah sebaliknya tidak dihitung."}
            {twoLineCounting && " Pengunjung harus melewati kedua batas agar tercatat."}
          </p>
        </div>
      )}
      {/* Control Bar (Bottom) */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-1 items-center gap-4">
          <Button
            type="button"
            onClick={streaming ? stopPreview : testCamera}
            disabled={testing && !streaming}
            variant={streaming ? "default" : "outline"}
          >
            {testing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : streaming ? (
              <Square size={12} fill="currentColor" />
            ) : (
              <Camera size={14} />
            )}
            {streaming ? "Hentikan" : "Nyalakan Kamera"}
          </Button>

          {preview && !hideLineUI && (
            <span className="hidden text-[10px] text-slate-400 sm:inline-block">
              Garis mengikuti pengaturan form.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
