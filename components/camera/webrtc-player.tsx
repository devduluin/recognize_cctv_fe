"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Maximize2,
  Minimize2,
  Radio,
  RefreshCw,
  Sliders,
  Volume2,
  VolumeX,
} from "lucide-react";
import CountingLineOverlay, { LineConfig } from "./counting-line-overlay";
import { containedVideoRect } from "./counting-line-geometry";
import DetectionBoxesOverlay, { DetectionBox } from "./detection-boxes-overlay";

export type { LineConfig, DetectionBox };
export type StreamMode = "webrtc" | "hls" | "mjpeg";

export interface StreamUrls {
  webrtc_whep?: string;
  webrtc_player?: string;
  hls?: string;
  rtsp_internal?: string;
}

export interface WebRTCPlayerProps {
  whepUrl?: string;
  webrtcPlayerUrl?: string;
  hlsUrl?: string;
  fallbackStreamUrl?: string;
  cameraName?: string;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  preferredMode?: StreamMode;
  lineConfig?: LineConfig;
  hideInternalSwitcher?: boolean;
  detections?: DetectionBox[];
  showDetections?: boolean;
  onToggleDetections?: (enabled: boolean) => void;
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
  lineConfig,
  hideInternalSwitcher = false,
  detections,
  showDetections,
  onToggleDetections,
  onModeChange,
  onStatusChange,
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mjpegRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const whepAbortRef = useRef<AbortController | null>(null);
  const webrtcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const whepResourceUrlRef = useRef<string | null>(null);

  const [activeMode, setActiveMode] = useState<StreamMode>(preferredMode);
  const [lastPreferredMode, setLastPreferredMode] = useState(preferredMode);
  if (lastPreferredMode !== preferredMode) {
    setLastPreferredMode(preferredMode);
    setActiveMode(preferredMode);
  }
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(muted);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const [internalShowDetections, setInternalShowDetections] = useState<boolean>(
    showDetections ?? true
  );
  const [videoViewport, setVideoViewport] = useState<(NonNullable<ReturnType<typeof containedVideoRect>> & { mediaWidth: number; mediaHeight: number }) | null>(null);

  const detectionsVisible = showDetections ?? internalShowDetections;

  const handleToggleDetections = useCallback(
    (enabled: boolean) => {
      setInternalShowDetections(enabled);
      onToggleDetections?.(enabled);
    },
    [onToggleDetections]
  );

  // Stable callback refs to prevent unnecessary useEffect re-triggers from parent renders
  const onStatusChangeRef = useRef(onStatusChange);
  const onModeChangeRef = useRef(onModeChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onModeChangeRef.current = onModeChange;
  }, [onStatusChange, onModeChange]);

  // Clean up all active streams (WebRTC & HLS)
  const cleanupStreams = useCallback(() => {
    if (webrtcTimerRef.current !== null) clearTimeout(webrtcTimerRef.current);
    webrtcTimerRef.current = null;
    whepAbortRef.current?.abort();
    whepAbortRef.current = null;
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

  // Update status safely (stable reference)
  const updateStatus = useCallback(
    (newStatus: "connecting" | "live" | "error", err?: string) => {
      setStatus(newStatus);
      if (err) setErrorMessage(err);
      else setErrorMessage("");
      onStatusChangeRef.current?.(newStatus);
    },
    []
  );

  // Switch mode safely (stable reference)
  const switchMode = useCallback(
    (newMode: StreamMode) => {
      setActiveMode(newMode);
      onModeChangeRef.current?.(newMode);
      setRetryNonce((n) => n + 1);
    },
    []
  );

  // WebRTC WHEP connection initialization using native HTML5 Video
  const startWebRTC = useCallback(async () => {
    const fallback = (message: string) => {
      cleanupStreams();
      if (fallbackStreamUrl) {
        switchMode("mjpeg");
      } else if (hlsUrl) {
        switchMode("hls");
      } else {
        updateStatus("error", message);
      }
    };
    if (!whepUrl) {
      fallback("URL WebRTC (WHEP) tidak tersedia");
      return;
    }

    cleanupStreams();
    updateStatus("connecting");
    const controller = new AbortController();
    whepAbortRef.current = controller;
    const isCurrent = () => !controller.signal.aborted && whepAbortRef.current === controller;
    webrtcTimerRef.current = setTimeout(() => {
      if (isCurrent()) fallback("Koneksi WebRTC melewati batas waktu.");
    }, 8000);

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
        if (!isCurrent()) return;
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
          updateStatus("live");
        }
      };

      pc.onconnectionstatechange = () => {
        if (!isCurrent()) return;
        const state = pc.connectionState;
        if (state === "connected") {
          if (webrtcTimerRef.current !== null) clearTimeout(webrtcTimerRef.current);
          webrtcTimerRef.current = null;
          updateStatus("live");
        } else if (state === "failed") {
          fallback("Koneksi WebRTC gagal");
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      if (!isCurrent()) return;
      await pc.setLocalDescription(offer);
      if (!isCurrent()) return;

      // Wait for ICE candidates gathering (important for MediaMTX non-trickle WHEP)
      if (pc.iceGatheringState !== "complete") {
        await new Promise<void>((resolve) => {
          function checkState() {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          }
          pc.addEventListener("icegatheringstatechange", checkState);
          setTimeout(resolve, 1200);
        });
      }

      if (!isCurrent()) return;
      // Send SDP offer via WHEP POST
      const sdpToSend = pc.localDescription?.sdp || offer.sdp;
      const res = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: sdpToSend,
        signal: controller.signal,
      });

      if (!isCurrent()) return;

      if (!res.ok) {
        throw new Error(`WHEP endpoint HTTP ${res.status}`);
      }

      // Store location header for session termination if provided
      const location = res.headers.get("Location");
      if (location) {
        whepResourceUrlRef.current = new URL(location, whepUrl).toString();
      }

      const answerSdp = await res.text();
      if (!isCurrent() || pc.signalingState === "closed") return;
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp }));
    } catch (err) {
      if (!isCurrent()) return;
      fallback(err instanceof Error ? err.message : "Gagal menghubungkan WebRTC");
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
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 1500,
        levelLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 1500,
      });
      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {});
        updateStatus("live");
      });

      let errorCount = 0;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              errorCount++;
              if (errorCount > 8 && fallbackStreamUrl) {
                cleanupStreams();
                switchMode("mjpeg");
              } else {
                setTimeout(() => {
                  if (hlsRef.current) {
                    hls.startLoad();
                  }
                }, 1500);
              }
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
    const frame = requestAnimationFrame(() => {
      if (activeMode === "webrtc") {
        void startWebRTC();
      } else if (activeMode === "hls") {
        startHLS();
      } else {
        cleanupStreams();
        updateStatus(fallbackStreamUrl ? "connecting" : "error", fallbackStreamUrl ? undefined : "URL stream backend tidak tersedia");
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      cleanupStreams();
    };
  }, [activeMode, retryNonce, startWebRTC, startHLS, cleanupStreams, updateStatus, fallbackStreamUrl]);

  const mjpegUrl = fallbackStreamUrl
    ? `${fallbackStreamUrl}${fallbackStreamUrl.includes("?") ? "&" : "?"}annotated=${detectionsVisible}`
    : undefined;

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;
    const measure = () => {
      const image = mjpegRef.current;
      const mediaWidth = activeMode === "mjpeg" ? image?.naturalWidth || 0 : video?.videoWidth || 0;
      const mediaHeight = activeMode === "mjpeg" ? image?.naturalHeight || 0 : video?.videoHeight || 0;
      const rect = containedVideoRect(container.clientWidth, container.clientHeight, mediaWidth, mediaHeight);
      const next = rect ? { ...rect, mediaWidth, mediaHeight } : null;
      setVideoViewport((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      return Boolean(rect);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    video?.addEventListener("loadedmetadata", measure);
    video?.addEventListener("resize", measure);
    const animation = requestAnimationFrame(measure);
    const poll = setInterval(() => { if (measure()) clearInterval(poll); }, 100);
    return () => {
      observer.disconnect();
      video?.removeEventListener("loadedmetadata", measure);
      video?.removeEventListener("resize", measure);
      cancelAnimationFrame(animation);
      clearInterval(poll);
    };
  }, [activeMode, mjpegUrl, retryNonce]);

  useEffect(() => {
    if (activeMode !== "mjpeg" || !mjpegUrl) return;
    let receivedFrame = false;
    const checkFrame = () => {
      const image = mjpegRef.current;
      if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
        receivedFrame = true;
        updateStatus("live");
        clearInterval(poll);
        clearTimeout(timeout);
      }
    };
    const poll = setInterval(checkFrame, 100);
    const timeout = setTimeout(() => {
      clearInterval(poll);
      if (!receivedFrame) updateStatus("error", "Belum menerima gambar kamera. Pastikan monitoring dan kamera aktif, lalu coba lagi.");
    }, 12000);
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [activeMode, mjpegUrl, retryNonce, updateStatus]);

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
    }
    setIsMuted(!isMuted);
  };

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-xl border border-white/10 bg-[#080d18] shadow-lg select-none ${className}`}
    >
      {/* Video Display (Native WebRTC & HLS via HTML5 Video) */}
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        playsInline
        muted={isMuted}
        className={`absolute inset-0 block h-full w-full object-contain transition-opacity duration-300 ${lineConfig?.mirror ? "-scale-x-100" : ""} ${
          status === "live" && activeMode !== "mjpeg" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* MJPEG Fallback Display (for AI YOLO detection bounding boxes) */}
      {activeMode === "mjpeg" && fallbackStreamUrl && (
        <img
          key={`${mjpegUrl}:${retryNonce}`}
          ref={mjpegRef}
          src={mjpegUrl}
          alt={cameraName}
          className="absolute inset-0 h-full w-full object-contain"
          onLoad={() => updateStatus("live")}
          onError={() => updateStatus("error", "MJPEG stream gagal dimuat")}
        />
      )}

      {videoViewport && <div data-camera-viewport className="pointer-events-none absolute" style={{ left: videoViewport.left, top: videoViewport.top, width: videoViewport.width, height: videoViewport.height }}>
        {showOverlay && lineConfig && (activeMode !== "mjpeg" || !detectionsVisible) && (
          <CountingLineOverlay config={{ ...lineConfig, mirror: false }} mediaWidth={videoViewport.mediaWidth} mediaHeight={videoViewport.mediaHeight} displayWidth={videoViewport.width} />
        )}
        {detectionsVisible && activeMode !== "mjpeg" && detections && detections.length > 0 && (
          <DetectionBoxesOverlay detections={detections} />
        )}
      </div>}

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

      {/* Top Header Badge & Mode Controls */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
        {/* Stream protocol indicator / Mode switcher */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Quick Stream Mode Switcher */}
          {!hideInternalSwitcher && (
            <div className="flex items-center rounded-lg bg-black/75 p-0.5 border border-white/15 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => handleToggleDetections(false)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  !detectionsVisible
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                title="Tampilan Bersih Realtime (tanpa box deteksi)"
              >
                <Radio className="size-3 text-emerald-400 animate-pulse" />
                <span>Realtime</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleDetections(true)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                  detectionsVisible
                    ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
                title="AI Detection (Bounding Box: Biru=Pria, Pink=Wanita, Kuning=Unknown)"
              >
                <Sliders className="size-3" />
                <span>AI Detection</span>
              </button>
            </div>
          )}

          {/* Toggle Lines Button (only relevant in WebRTC/HLS mode where lines are an overlay) */}
          {activeMode !== "mjpeg" && lineConfig && (
            <button
              type="button"
              onClick={() => setShowOverlay(!showOverlay)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold backdrop-blur-md border transition ${
                showOverlay
                  ? "bg-black/75 border-emerald-500/40 text-emerald-300 hover:bg-black/90"
                  : "bg-black/50 border-white/10 text-slate-400 hover:text-slate-300"
              }`}
              title={showOverlay ? "Sembunyikan Garis Deteksi" : "Tampilkan Garis Deteksi"}
            >
              {showOverlay ? <Eye className="size-3 text-emerald-400" /> : <EyeOff className="size-3 text-slate-400" />}
              <span className="hidden sm:inline">Garis {showOverlay ? "ON" : "OFF"}</span>
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
          {/* Protocol Switcher Dropdown (HLS / Advanced) */}
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
                    <span>MJPEG (YOLO Box)</span>
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
