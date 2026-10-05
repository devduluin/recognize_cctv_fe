"use client";

import React, { useState } from "react";
import { Maximize, RefreshCw, Video, Radio, Sliders } from "lucide-react";
import WebRTCPlayer, { StreamUrls } from "./webrtc-player";

export interface CameraStreamCellProps {
  index: number;
  camera: {
    camera_id: string;
    name: string;
    running?: boolean;
    mediamtx_path?: string;
    stream_urls?: StreamUrls;
  };
  mjpegStreamUrl?: string;
  isRunning: boolean;
  onFullscreen?: (cameraId: string) => void;
  className?: string;
}

export default function CameraStreamCell({
  index,
  camera,
  mjpegStreamUrl,
  isRunning,
  onFullscreen,
  className = "",
}: CameraStreamCellProps) {
  const [streamError, setStreamError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<"webrtc" | "mjpeg">("webrtc");

  const camId = camera.camera_id;
  const urls = camera.stream_urls;

  // Determine WHEP and HLS URLs
  // If backend provided localhost and client is running from different IP/host, adapt dynamically
  const whepUrl = urls?.webrtc_whep;
  const hlsUrl = urls?.hls;

  const handleFullscreen = () => {
    if (onFullscreen) {
      onFullscreen(camId);
    } else {
      const el = document.getElementById(`camera-cell-${camId}`);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (el) {
        el.requestFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div
      id={`camera-cell-${camId}`}
      className={`group/cell relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#101c30] shadow-md transition-all ${className}`}
    >
      {/* Camera Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-white/10 text-[11px] font-semibold text-white/90">
            {index + 1}
          </span>
          <span className="max-w-[200px] truncate font-medium text-white" title={camera.name}>
            {camera.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && mjpegStreamUrl && (
            <div className="flex items-center rounded-lg bg-black/60 p-0.5 border border-white/15">
              <button
                type="button"
                onClick={() => setMode("webrtc")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  mode === "webrtc"
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                title="WebRTC Realtime (<300ms latency)"
              >
                <Radio className="size-3 text-emerald-400 animate-pulse" />
                <span>Realtime</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("mjpeg")}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  mode === "mjpeg"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                title="AI Detection (Bounding Box)"
              >
                <Sliders className="size-3" />
                <span>AI Detection</span>
              </button>
            </div>
          )}
          <button
            type="button"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            title="Layar Penuh Kamera Ini"
            onClick={handleFullscreen}
          >
            <Maximize size={13} />
          </button>
        </div>
      </div>

      {/* Video Content */}
      <div className="relative aspect-video w-full overflow-hidden bg-black grid place-items-center">
        {isRunning && !streamError ? (
          <WebRTCPlayer
            key={`${reloadKey}-${camId}`}
            whepUrl={whepUrl}
            hlsUrl={hlsUrl}
            fallbackStreamUrl={mjpegStreamUrl}
            preferredMode={mode}
            hideInternalSwitcher
            onModeChange={(m) => {
              if (m === "webrtc" || m === "mjpeg") setMode(m);
            }}
            cameraName={camera.name}
            className="size-full"
            onStatusChange={(status) => {
              if (status === "error") {
                setStreamError(true);
              } else {
                setStreamError(false);
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400">
            <Video size={30} className="mb-2 text-slate-500" />
            <p className="text-xs">
              {streamError ? "Stream tidak dapat dimuat" : "Monitoring belum berjalan"}
            </p>
            {streamError && (
              <button
                type="button"
                onClick={() => {
                  setStreamError(false);
                  setReloadKey((k) => k + 1);
                }}
                className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-white hover:bg-white/10 transition"
              >
                <RefreshCw size={12} className="mr-1" />
                Muat ulang
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
