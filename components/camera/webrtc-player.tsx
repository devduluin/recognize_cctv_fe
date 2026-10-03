"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Maximize2,
  Minimize2,
  Radio,
  RefreshCw,
  Sliders,
  Volume2,
  VolumeX,
} from "lucide-react";

export type StreamMode = "webrtc" | "hls" | "mjpeg";

export interface StreamUrls {
  webrtc_whep?: string;
  webrtc_player?: string;
  hls?: string;
  rtsp_internal?: string;
}

export interface WebRTCPlayerProps {
  whepUrl?: string;
  hlsUrl?: string;
  fallbackStreamUrl?: string;
  cameraName?: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  preferredMode?: StreamMode;
  onModeChange?: (mode: StreamMode) => void;
  onStatusChange?: (status: "connecting" | "live" | "error") => void;
}

export default function WebRTCPlayer({
  whepUrl,
  hlsUrl,
  fallbackStreamUrl,
  cameraName = "CCTV Camera",
  autoPlay = true,
  muted = true,
  className = "",
  preferredMode = "webrtc",
  onModeChange,
  onStatusChange,
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const whepResourceUrlRef = useRef<string | null>(null);

  const [activeMode, setActiveMode] = useState<StreamMode>(preferredMode);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(muted);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [retryNonce, setRetryNonce] = useState<number>(0);

  // Clean up all active streams (WebRTC & HLS)
  const cleanupStreams = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // Ignore close errors
      }
      pcRef.current = null;
    }

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        // Ignore destroy errors
      }
      hlsRef.current = null;
    }

    if (whepResourceUrlRef.current) {
      try {
        // Send WHEP DELETE if session is terminating
        fetch(whepResourceUrlRef.current, { method: "DELETE" }).catch(() => {});
      } catch {
        // Ignore
      }
      whepResourceUrlRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

  // Update status safely
  const updateStatus = useCallback(
    (newStatus: "connecting" | "live" | "error", err?: string) => {
      setStatus(newStatus);
      if (err) setErrorMessage(err);
      else setErrorMessage("");
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Switch mode safely
  const switchMode = useCallback(
    (newMode: StreamMode) => {
      setActiveMode(newMode);
      onModeChange?.(newMode);
      setRetryNonce((n) => n + 1);
    },
    [onModeChange]
  );

  // WebRTC WHEP connection initialization
  const startWebRTC = useCallback(async () => {
    if (!whepUrl) {
      if (hlsUrl) {
        switchMode("hls");
      } else if (fallbackStreamUrl) {
        switchMode("mjpeg");
      } else {
        updateStatus("error", "URL WebRTC (WHEP) tidak tersedia");
      }
      return;
    }

    cleanupStreams();
    updateStatus("connecting");

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      // Subscribe to video and audio
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
          updateStatus("live");
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          updateStatus("live");
        } else if (state === "failed" || state === "disconnected") {
          // If WebRTC fails, automatically attempt HLS fallback
          if (hlsUrl) {
            console.warn("WebRTC disconnected or failed, falling back to HLS...");
            switchMode("hls");
          } else if (fallbackStreamUrl) {
            switchMode("mjpeg");
          } else {
            updateStatus("error", "Koneksi WebRTC terputus");
          }
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send SDP offer via WHEP POST
      const res = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!res.ok) {
        throw new Error(`WHEP endpoint error (HTTP ${res.status})`);
      }

      // Store location header for session termination if provided
      const location = res.headers.get("Location");
      if (location) {
        whepResourceUrlRef.current = new URL(location, whepUrl).toString();
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp }));
    } catch (err) {
      console.warn("Failed starting WebRTC:", err);
      if (hlsUrl) {
        switchMode("hls");
      } else if (fallbackStreamUrl) {
        switchMode("mjpeg");
      } else {
        updateStatus("error", err instanceof Error ? err.message : "Gagal menghubungkan WebRTC");
      }
    }
  }, [whepUrl, hlsUrl, fallbackStreamUrl, cleanupStreams, updateStatus, switchMode]);

  // HLS stream playback
  const startHLS = useCallback(() => {
    if (!hlsUrl) {
      if (fallbackStreamUrl) {
        switchMode("mjpeg");
      } else {
        updateStatus("error", "URL HLS tidak tersedia");
      }
      return;
    }

    cleanupStreams();
    updateStatus("connecting");

    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        enableWorker: true,
      });
      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {});
        updateStatus("live");
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              cleanupStreams();
              if (fallbackStreamUrl) {
                switchMode("mjpeg");
              } else {
                updateStatus("error", "Gagal memutar HLS stream");
              }
              break;
          }
        }
      });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari HLS
      videoEl.src = hlsUrl;
      videoEl.addEventListener("loadedmetadata", () => {
        videoEl.play().catch(() => {});
        updateStatus("live");
      });
      videoEl.addEventListener("error", () => {
        if (fallbackStreamUrl) {
          switchMode("mjpeg");
        } else {
          updateStatus("error", "Gagal memutar HLS native");
        }
      });
    } else {
      if (fallbackStreamUrl) {
        switchMode("mjpeg");
      } else {
        updateStatus("error", "Format HLS tidak didukung browser ini");
      }
    }
  }, [hlsUrl, fallbackStreamUrl, cleanupStreams, updateStatus, switchMode]);

  // Main lifecycle effect for stream initialization
  useEffect(() => {
    if (activeMode === "webrtc") {
      void startWebRTC();
    } else if (activeMode === "hls") {
      startHLS();
    } else {
      cleanupStreams();
      updateStatus("live");
    }

    return () => {
      cleanupStreams();
    };
  }, [activeMode, retryNonce, startWebRTC, startHLS, cleanupStreams, updateStatus]);

  // Handle Fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      // Fullscreen not supported
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-xl border border-white/10 bg-[#080d18] shadow-lg select-none ${className}`}
    >
      {/* Video Display (WebRTC & HLS) */}
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        playsInline
        muted={isMuted}
        className={`h-full w-full object-contain transition-opacity duration-300 ${
          status === "live" && activeMode !== "mjpeg" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* MJPEG Fallback Display */}
      {activeMode === "mjpeg" && fallbackStreamUrl && (
        <img
          src={fallbackStreamUrl}
          alt={cameraName}
          className="absolute inset-0 h-full w-full object-contain"
          onLoad={() => updateStatus("live")}
          onError={() => updateStatus("error", "MJPEG stream gagal dimuat")}
        />
      )}

      {/* Status Overlay: Connecting */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] transition-all">
          <Loader2 className="size-8 animate-spin text-cyan-400 mb-2" />
          <p className="text-xs font-medium text-slate-200">
            Menghubungkan {activeMode.toUpperCase()} stream...
          </p>
          <span className="text-[10px] text-slate-400 mt-1">
            {activeMode === "webrtc" ? "Ultra-low latency (<300ms)" : "Low-Latency HLS"}
          </span>
        </div>
      )}

      {/* Status Overlay: Error */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
          <AlertCircle className="size-8 text-rose-400 mb-2" />
          <p className="text-xs font-medium text-rose-200">Gagal memuat stream video</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] truncate">{errorMessage}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setRetryNonce((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/20"
            >
              <RefreshCw className="size-3" /> Coba Lagi
            </button>
            {hlsUrl && activeMode !== "hls" && (
              <button
                type="button"
                onClick={() => switchMode("hls")}
                className="inline-flex items-center rounded-lg bg-cyan-600/20 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:bg-cyan-600/30"
              >
                Gunakan HLS
              </button>
            )}
            {fallbackStreamUrl && activeMode !== "mjpeg" && (
              <button
                type="button"
                onClick={() => switchMode("mjpeg")}
                className="inline-flex items-center rounded-lg bg-yellow-600/20 px-2.5 py-1 text-xs font-medium text-yellow-300 transition hover:bg-yellow-600/30"
              >
                Gunakan MJPEG
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Header Badge */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        {/* Stream protocol indicator */}
        <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 backdrop-blur-md border border-white/10 text-[11px] pointer-events-auto">
          {status === "live" ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeMode === "webrtc" ? "WebRTC (<300ms)" : activeMode === "hls" ? "HLS Live" : "MJPEG"}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <span className="size-1.5 rounded-full bg-amber-400" />
              {status.toUpperCase()}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
          {/* Protocol Switcher Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="rounded p-1 bg-black/60 text-slate-300 backdrop-blur-md border border-white/10 hover:text-white transition"
              title="Pilihan Protokol Streaming"
            >
              <Sliders className="size-3.5" />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-7 z-20 w-44 rounded-lg bg-[#0e1626] border border-white/15 p-1.5 shadow-2xl text-xs flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 px-2 py-0.5 font-semibold uppercase tracking-wider">
                  Protokol Stream
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    switchMode("webrtc");
                  }}
                  className={`flex items-center justify-between w-full px-2 py-1 rounded text-left transition ${
                    activeMode === "webrtc" ? "bg-cyan-500/20 text-cyan-300 font-medium" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span>WebRTC (WHEP)</span>
                  {activeMode === "webrtc" && <CheckCircle2 className="size-3 text-cyan-400" />}
                </button>
                {hlsUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      switchMode("hls");
                    }}
                    className={`flex items-center justify-between w-full px-2 py-1 rounded text-left transition ${
                      activeMode === "hls" ? "bg-cyan-500/20 text-cyan-300 font-medium" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span>LL-HLS</span>
                    {activeMode === "hls" && <CheckCircle2 className="size-3 text-cyan-400" />}
                  </button>
                )}
                {fallbackStreamUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      switchMode("mjpeg");
                    }}
                    className={`flex items-center justify-between w-full px-2 py-1 rounded text-left transition ${
                      activeMode === "mjpeg" ? "bg-cyan-500/20 text-cyan-300 font-medium" : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <span>MJPEG (Legacy)</span>
                    {activeMode === "mjpeg" && <CheckCircle2 className="size-3 text-cyan-400" />}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Audio toggle */}
          {activeMode !== "mjpeg" && (
            <button
              type="button"
              onClick={toggleMute}
              className="rounded p-1 bg-black/60 text-slate-300 backdrop-blur-md border border-white/10 hover:text-white transition"
              title={isMuted ? "Unmute audio" : "Mute audio"}
            >
              {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
          )}

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded p-1 bg-black/60 text-slate-300 backdrop-blur-md border border-white/10 hover:text-white transition"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
