"use client";

import React from "react";

export interface DetectionBox {
  id?: string | number;
  track_id?: string | number;
  visitor_id?: string;
  label: string;
  gender?: "male" | "female" | "unknown" | string;
  color?: string;
  box: [number, number, number, number]; // [x1, y1, x2, y2] normalized in 0..1
  zone_seconds?: number | null;
  counting_status?: string;
  counting_message?: string;
}

export interface DetectionBoxesOverlayProps {
  detections?: DetectionBox[];
  mirror?: boolean;
  className?: string;
}

export default function DetectionBoxesOverlay({
  detections = [],
  mirror = false,
  className = "",
}: DetectionBoxesOverlayProps) {
  if (!detections || detections.length === 0) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 size-full overflow-hidden select-none z-15 ${className}`}
      aria-hidden="true"
    >
      {detections.map((det, index) => {
        const [x1, y1, x2, y2] = det.box;
        if (
          typeof x1 !== "number" ||
          typeof y1 !== "number" ||
          typeof x2 !== "number" ||
          typeof y2 !== "number"
        ) {
          return null;
        }

        // Percentage calculations
        const widthPct = Math.max(1, Math.min(100, (x2 - x1) * 100));
        const heightPct = Math.max(1, Math.min(100, (y2 - y1) * 100));

        // Horizontal positioning with mirror support
        const leftPct = mirror
          ? Math.max(0, Math.min(100, (1 - x2) * 100))
          : Math.max(0, Math.min(100, x1 * 100));
        const topPct = Math.max(0, Math.min(100, y1 * 100));

        // Color fallback based on gender
        const gender = (det.gender || "unknown").toLowerCase();
        const boxColor =
          det.color ||
          (gender === "female"
            ? "#ec4899"
            : gender === "male"
              ? "#38bdf8"
              : "#facc15");

        const key = det.id ?? det.track_id ?? index;
        const isNearTop = topPct < 8;

        return (
          <div
            key={key}
            className="absolute rounded-md border-2 transition-all duration-100 ease-out"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              borderColor: boxColor,
              boxShadow: `0 0 10px ${boxColor}66`,
            }}
          >
            {/* Top Label Tag */}
            <div
              className={`absolute left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md flex items-center gap-1 transition-all ${
                isNearTop ? "top-1" : "-top-6"
              }`}
              style={{
                backgroundColor: boxColor,
                color: gender === "unknown" ? "#0f172a" : "#ffffff",
              }}
            >
              <span>{det.label || `Track ${det.track_id ?? "?"}`}</span>
            </div>

            {det.counting_message && (
              <div className="absolute bottom-1 left-1 max-w-[240px] rounded bg-slate-950/95 px-2 py-1 text-[11px] leading-snug text-white">
                {det.counting_message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
