"use client";
import { visitorFetch } from "./auth/visitor-api";
import { Button } from "./ui/button";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Square } from "lucide-react";

const API_BASE =
  (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "") + "/api/v1/events";

export default function CameraTestPreview({
  source,
  position,
  orientation,
  angle = 0,
  reversed,
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
  const active = useRef<AbortController | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

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
  };

  const testCamera = useCallback(async () => {
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
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 10000);
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
      const response = await visitorFetch(`${API_BASE}/camera-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const radians = angle * Math.PI / 180;
  const horizontal = orientation === "horizontal";
  const normal = horizontal
    ? { x: -Math.sin(radians), y: Math.cos(radians) }
    : { x: Math.cos(radians), y: Math.sin(radians) };
  const anchor = horizontal
    ? { x: frameSize.width / 2, y: frameSize.height * position / 100 }
    : { x: frameSize.width * position / 100, y: frameSize.height / 2 };
  const span = 2 * Math.hypot(frameSize.width, frameSize.height);
  const zoneHalfWidth = (horizontal ? frameSize.height : frameSize.width) * 0.10;
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
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden group-data-[compact=true]/preview:h-[140px] group-data-[compact=true]/preview:aspect-auto">
        <canvas
          ref={canvas}
          aria-label="Video live kamera event"
          className={`absolute inset-0 h-full w-full object-contain ${preview ? "" : "invisible"} ${mirror ? "-scale-x-100" : ""}`}
        />
        {preview ? (
          <div className="relative h-full w-full">
            {!hideLineUI && (
              <svg
                role="img"
                aria-label={`Dua garis ${orientation}, kemiringan ${angle} derajat, posisi ${position} persen. Masuk ${reversed ? "B ke A" : "A ke B"}.`}
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${frameSize.width} ${frameSize.height}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {[-zoneHalfWidth, zoneHalfWidth].map((offset, index) => {
                  const x = anchor.x + normal.x * offset;
                  const y = anchor.y + normal.y * offset;
                  return (
                    <g key={index}>
                      <line
                        x1={x - normal.y * span} y1={y + normal.x * span}
                        x2={x + normal.y * span} y2={y - normal.x * span}
                        stroke="#22c55e" strokeWidth={2} vectorEffect="non-scaling-stroke"
                      />
                      <text x={x + 8} y={y - 12} fill="white" stroke="black" strokeWidth={3} paintOrder="stroke" fontSize={32}>
                        {index === 0 ? "A" : "B"}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
            {testing ? (
              <>
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-[#0c2e73]" />
                </div>
                <p role="status" className="text-xs font-medium text-slate-600">
                  Menghubungkan...
                </p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center text-[#0c2e73]">
                  <Camera size={34} />
                </div>
                <p className="text-lg font-semibold text-neutral-700">
                  Preview Kamera
                </p>
              </>
            )}
          </div>
        )}

        {/* Status Badge (Top Right) */}
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
      </div>

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
