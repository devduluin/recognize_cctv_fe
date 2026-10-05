"use client";

import React from "react";

export interface LineConfig {
  linePosition?: number;
  lineOrientation?: "horizontal" | "vertical" | string;
  lineAngle?: number;
  reverseDirection?: boolean;
  twoLineCounting?: boolean;
  zoneWidthRatio?: number;
  mirror?: boolean;
}

export interface CountingLineOverlayProps {
  config?: LineConfig;
  showLabels?: boolean;
  className?: string;
}

export default function CountingLineOverlay({
  config,
  showLabels = true,
  className = "",
}: CountingLineOverlayProps) {
  if (!config) return null;

  const rawPos = Number(config.linePosition ?? 0.5);
  const normalizedPos = rawPos > 1 ? rawPos / 100 : rawPos;
  const position = Math.max(0.05, Math.min(0.95, normalizedPos));

  const orientation = config.lineOrientation === "vertical" ? "vertical" : "horizontal";
  const twoLine = config.twoLineCounting ?? true;

  const rawZone = Number(config.zoneWidthRatio ?? 0.20);
  const normalizedZone = rawZone > 1 ? rawZone / 100 : rawZone;
  const zoneRatio = Math.max(0.02, Math.min(0.5, normalizedZone));

  const reversed = Boolean(config.reverseDirection);
  const mirror = Boolean(config.mirror);

  if (twoLine) {
    const half = zoneRatio / 2;
    const posA = Math.max(0, position - half) * 100;
    const posB = Math.min(100, position + half) * 100;
    const zoneStart = Math.min(posA, posB);
    const zoneSize = Math.abs(posB - posA);

    if (orientation === "vertical") {
      // Reversed: IN is B -> A (Right to Left), OUT is A -> B (Left to Right)
      // Normal: IN is A -> B (Left to Right), OUT is B -> A (Right to Left)
      const inArrow = reversed ? "←" : "→";
      const outArrow = reversed ? "→" : "←";
      const inText = reversed ? "IN: B → A" : "IN: A → B";
      const outText = reversed ? "OUT: A → B" : "OUT: B → A";

      return (
        <div
          className={`pointer-events-none absolute inset-0 size-full overflow-hidden select-none ${mirror ? "-scale-x-100" : ""} ${className}`}
          aria-hidden="true"
        >
          {/* Shaded Crossing Zone */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/15 border-x border-dashed border-emerald-400/40 backdrop-brightness-105 transition-all duration-200"
            style={{ left: `${zoneStart}%`, width: `${zoneSize}%` }}
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <span className="rounded bg-black/60 px-2 py-0.5 text-[9px] font-bold tracking-widest text-emerald-300 border border-emerald-500/30 uppercase">
                Crossing Zone
              </span>
            </div>
          </div>

          {/* Line A */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-[0_0_8px_#22c55e] transition-all duration-200"
            style={{ left: `${posA}%` }}
          >
            <div className="absolute top-2 -left-3 flex flex-col items-center">
              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-md border border-emerald-300/40">
                A
              </span>
            </div>
          </div>

          {/* Line B */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_8px_#06b6d4] transition-all duration-200"
            style={{ left: `${posB}%` }}
          >
            <div className="absolute top-2 -left-3 flex flex-col items-center">
              <span className="rounded bg-cyan-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-md border border-cyan-300/40">
                B
              </span>
            </div>
          </div>

          {/* Direction Indicator Pills */}
          {showLabels && (
            <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-2 pointer-events-none">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/75 border border-emerald-500/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 shadow-lg backdrop-blur-xs">
                <span className="text-xs font-black">{inArrow}</span> {inText}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/75 border border-rose-500/60 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 shadow-lg backdrop-blur-xs">
                <span className="text-xs font-black">{outArrow}</span> {outText}
              </span>
            </div>
          )}
        </div>
      );
    } else {
      // Horizontal orientation
      const inArrow = reversed ? "↑" : "↓";
      const outArrow = reversed ? "↓" : "↑";
      const inText = reversed ? "IN: B → A" : "IN: A → B";
      const outText = reversed ? "OUT: A → B" : "OUT: B → A";

      return (
        <div
          className={`pointer-events-none absolute inset-0 size-full overflow-hidden select-none ${mirror ? "-scale-x-100" : ""} ${className}`}
          aria-hidden="true"
        >
          {/* Shaded Crossing Zone */}
          <div
            className="absolute left-0 right-0 bg-emerald-500/15 border-y border-dashed border-emerald-400/40 backdrop-brightness-105 transition-all duration-200"
            style={{ top: `${zoneStart}%`, height: `${zoneSize}%` }}
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <span className="rounded bg-black/60 px-2 py-0.5 text-[9px] font-bold tracking-widest text-emerald-300 border border-emerald-500/30 uppercase">
                Crossing Zone
              </span>
            </div>
          </div>

          {/* Line A */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_#22c55e] transition-all duration-200"
            style={{ top: `${posA}%` }}
          >
            <div className="absolute left-2 -top-2.5">
              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-md border border-emerald-300/40">
                A
              </span>
            </div>
          </div>

          {/* Line B */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_#06b6d4] transition-all duration-200"
            style={{ top: `${posB}%` }}
          >
            <div className="absolute left-2 -top-2.5">
              <span className="rounded bg-cyan-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-md border border-cyan-300/40">
                B
              </span>
            </div>
          </div>

          {/* Direction Indicator Pills */}
          {showLabels && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 pointer-events-none">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/75 border border-emerald-500/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300 shadow-lg backdrop-blur-xs">
                <span>{inArrow}</span> {inText}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/75 border border-rose-500/60 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 shadow-lg backdrop-blur-xs">
                <span>{outArrow}</span> {outText}
              </span>
            </div>
          )}
        </div>
      );
    }
  }

  // Single Line Mode
  const arrow =
    orientation === "horizontal"
      ? reversed
        ? "↑"
        : "↓"
      : reversed
        ? "←"
        : "→";

  return (
    <div
      className={`pointer-events-none absolute inset-0 size-full overflow-hidden select-none ${mirror ? "-scale-x-100" : ""} ${className}`}
      aria-hidden="true"
    >
      <div
        className={`absolute bg-amber-400 shadow-[0_0_8px_#f59e0b] ${
          orientation === "horizontal" ? "left-0 right-0 h-0.5" : "top-0 bottom-0 w-0.5"
        }`}
        style={
          orientation === "horizontal"
            ? { top: `${position * 100}%` }
            : { left: `${position * 100}%` }
        }
      >
        <span
          className={`absolute whitespace-nowrap rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-950 shadow-md ${
            orientation === "horizontal" ? "right-2 bottom-1" : "left-1 top-2"
          }`}
        >
          MASUK {arrow}
        </span>
      </div>
    </div>
  );
}
