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
  iceServers?: RTCIceServer[];
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
  iceServers,
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
  const hlsAbortRef = useRef<AbortController | null>(null);
  const hlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whepResourceUrlRef = useRef<string | null>(null);
  // WebRTC retry state: MediaMTX answers WHEP with 404 until the camera path is
  // ready (e.g. right after an event starts), and sessions can drop briefly.
  const webrtcRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webrtcAttemptRef = useRef(0);
  const webrtcDeadlineRef = useRef(0);
  const startWebRTCRef = useRef<(isRetry?: boolean) => void>(() => {});

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
    if (webrtcRetryTimerRef.current !== null) clearTimeout(webrtcRetryTimerRef.current);
    webrtcRetryTimerRef.current = null;
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

    hlsAbortRef.current?.abort();
    hlsAbortRef.current = null;
    if (hlsTimerRef.current !== null) clearTimeout(hlsTimerRef.current);
    hlsTimerRef.current = null;
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
  const startWebRTC = useCallback(async (isRetry = false) => {
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
    if (!isRetry) {
      webrtcAttemptRef.current = 0;
      webrtcDeadlineRef.current = Date.now() + 25000;
    }
    // Transient failures reconnect with backoff before falling back to MJPEG/HLS.
    const retryOrFallback = (message: string) => {
      if (Date.now() >= webrtcDeadlineRef.current) {
        fallback(message);
        return;
      }
      cleanupStreams();
      updateStatus("connecting");
      const delay = Math.min(3000, 500 * 2 ** webrtcAttemptRef.current++);
      webrtcRetryTimerRef.current = setTimeout(() => startWebRTCRef.current(true), delay);
    };

    cleanupStreams();
    updateStatus("connecting");
    const controller = new AbortController();
    whepAbortRef.current = controller;
    const isCurrent = () => !controller.signal.aborted && whepAbortRef.current === controller;
    webrtcTimerRef.current = setTimeout(() => {
      if (isCurrent()) retryOrFallback("Koneksi WebRTC melewati batas waktu.");
    }, 8000);
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      const pc = new RTCPeerConnection({
        iceServers: iceServers ?? [],
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
        if (disconnectTimer !== null) clearTimeout(disconnectTimer);
        disconnectTimer = null;
        if (state === "connected") {
          if (webrtcTimerRef.current !== null) clearTimeout(webrtcTimerRef.current);
          webrtcTimerRef.current = null;
          // A later drop gets a fresh retry window.
          webrtcAttemptRef.current = 0;
          webrtcDeadlineRef.current = Date.now() + 25000;
          updateStatus("live");
        } else if (state === "disconnected") {
          // Often recovers by itself; otherwise reconnect instead of freezing.
          disconnectTimer = setTimeout(() => {
            if (isCurrent() && pc.connectionState === "disconnected") retryOrFallback("Koneksi WebRTC terputus");
          }, 4000);
        } else if (state === "failed") {
          retryOrFallback("Koneksi WebRTC gagal");
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
        // While an event (re)starts the camera path is briefly unregistered
        // (400 "not configured") or has no stream yet (404); 5xx is transient too.
        const detail = await res.text().catch(() => "");
        if (!isCurrent()) return;
        if (res.status === 404 || res.status >= 500 || (res.status === 400 && /not configured/i.test(detail))) {
          retryOrFallback(`Stream kamera belum siap (HTTP ${res.status})`);
          return;
        }
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
      // Network errors (e.g. local media service restarting) are retried.
      if (err instanceof TypeError) retryOrFallback(err.message);
      else fallback(err instanceof Error ? err.message : "Gagal menghubungkan WebRTC");
    }
  }, [whepUrl, iceServers, hlsUrl, fallbackStreamUrl, cleanupStreams, updateStatus, switchMode]);
  useEffect(() => { startWebRTCRef.current = (isRetry) => { void startWebRTC(isRetry); }; }, [startWebRTC]);

  // Bound startup and recovery: a manifest alone does not mean video is playing.
  const startHLS = useCallback(() => {
    cleanupStreams();
    updateStatus("connecting");
    const controller = new AbortController();
    hlsAbortRef.current = controller;
    const isCurrent = () => !controller.signal.aborted && hlsAbortRef.current === controller;
    const fail = (message: string) => {
      if (!isCurrent()) return;
      cleanupStreams();
      if (fallbackStreamUrl) switchMode("mjpeg");
      else updateStatus("error", message);
    };
    if (!hlsUrl) { fail("URL HLS tidak tersedia"); return; }
    const videoEl = videoRef.current;
    if (!videoEl) { fail("Pemutar video belum tersedia."); return; }
    const armTimeout = () => {
      if (hlsTimerRef.current !== null) clearTimeout(hlsTimerRef.current);
      hlsTimerRef.current = setTimeout(() => fail("Video kamera tidak diterima dalam 20 detik. Periksa koneksi kamera, layanan media lokal, dan codec kamera."), 20000);
    };
    armTimeout();
    videoEl.addEventListener("playing", () => {
      if (!isCurrent()) return;
      if (hlsTimerRef.current !== null) clearTimeout(hlsTimerRef.current);
      hlsTimerRef.current = null;
      updateStatus("live");
    }, { signal: controller.signal });
    videoEl.addEventListener("waiting", () => {
      if (isCurrent() && hlsTimerRef.current === null) { updateStatus("connecting"); armTimeout(); }
    }, { signal: controller.signal });
    videoEl.addEventListener("error", () => fail("Video kamera tidak dapat diputar. Periksa codec dan layanan media."), { signal: controller.signal });
    const play = () => {
      videoEl.play().catch(() => fail("Pemutaran video kamera gagal. Coba hubungkan kembali."));
    };
    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3, enableWorker: true,
        manifestLoadingMaxRetry: 2, manifestLoadingRetryDelay: 1500,
        levelLoadingMaxRetry: 2, levelLoadingRetryDelay: 1500 });
      hlsRef.current = hls;
      let networkErrors = 0;
      let mediaErrors = 0;
      hls.on(Hls.Events.MANIFEST_PARSED, () => { if (isCurrent()) play(); });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!isCurrent() || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && ++networkErrors <= 2) {
          if (hlsTimerRef.current === null) armTimeout();
          const timer = setTimeout(() => { if (isCurrent()) hls.startLoad(); }, 1500);
          controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && ++mediaErrors <= 2) {
          if (hlsTimerRef.current === null) armTimeout();
          hls.recoverMediaError();
        } else fail("Koneksi atau pemutaran HLS gagal. Periksa kamera dan layanan media lokal.");
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.addEventListener("loadedmetadata", play, { signal: controller.signal });
      videoEl.src = hlsUrl;
    } else fail("Format HLS tidak didukung browser ini");
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
