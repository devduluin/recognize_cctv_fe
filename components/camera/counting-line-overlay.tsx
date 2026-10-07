"use client";

import { countingLineGeometry } from "./counting-line-geometry";

export interface LineConfig {
  linePosition?: number;
  lineOrientation?: "horizontal" | "vertical" | string;
  lineAngle?: number;
  reverseDirection?: boolean;
  twoLineCounting?: boolean;
  zoneWidthRatio?: number;
  mirror?: boolean;
  countingDirection?: "in" | "out" | "auto" | string;
  frameSize?: { width: number; height: number };
}

export interface CountingLineOverlayProps {
  config?: LineConfig;
  mediaWidth?: number;
  mediaHeight?: number;
  displayWidth?: number;
  showLabels?: boolean;
  className?: string;
}

export default function CountingLineOverlay({ config, mediaWidth = 1280, mediaHeight = 720, displayWidth = mediaWidth, showLabels = true, className = "" }: CountingLineOverlayProps) {
  if (!config || mediaWidth <= 0 || mediaHeight <= 0) return null;
  const width = config.frameSize?.width || mediaWidth;
  const height = config.frameSize?.height || mediaHeight;
  const { lines, entryArrow, exitArrow } = countingLineGeometry(width, height, config);
  const twoLines = lines.length === 2;
  const unit = width / Math.max(1, displayWidth);
  const role = config.countingDirection;
  const badge = "rounded-md bg-slate-950/90 px-2 py-1 text-xs font-medium text-white";
  const labelPositions: { x: number; y: number; width: number; label: string }[] = [];
  for (const [index, line] of lines.entries()) {
    const label = twoLines ? `Batas ${index + 1}` : "Garis hitung";
    const labelWidth = (label.length * 7 + 16) * unit;
    const x = Math.max(4 * unit, Math.min(width - labelWidth - 4 * unit, (line.labelPoint?.x ?? 0) + 8 * unit));
    let y = Math.max(4 * unit, Math.min(height - 28 * unit, (line.labelPoint?.y ?? 0) - 12 * unit));
    for (const previous of labelPositions) {
      if (x < previous.x + previous.width && x + labelWidth > previous.x && y < previous.y + 24 * unit && y + 24 * unit > previous.y) {
        y = previous.y + 52 * unit <= height ? previous.y + 28 * unit : Math.max(4 * unit, previous.y - 28 * unit);
      }
    }
    labelPositions.push({ x, y, width: labelWidth, label });
  }
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`} aria-hidden="true">
      <svg className="absolute inset-0 size-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {twoLines && <polygon fill="#67e8f9" fillOpacity="0.10" points={[lines[0].start, lines[0].end, lines[1].end, lines[1].start].map((point) => `${point.x},${point.y}`).join(" ")} />}
        {lines.map((line, index) => {
          const { label, width: labelWidth, x, y } = labelPositions[index];
          return <g key={index}>
            <line x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} stroke="#0f172a" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            <line x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} stroke="#67e8f9" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {showLabels && line.labelPoint && <g>
              <line x1={line.labelPoint.x} y1={line.labelPoint.y} x2={x + labelWidth / 2} y2={y + 12 * unit} stroke="#67e8f9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <rect x={x} y={y} width={labelWidth} height={24 * unit} rx={5 * unit} fill="#0f172a" fillOpacity="0.95" />
              <text x={x + 8 * unit} y={y + 16 * unit} fill="white" fontSize={12 * unit}>{label}</text>
            </g>}
          </g>;
        })}
      </svg>
      {showLabels && <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-center gap-1.5">
        {role === "in" || role === "out" ? <span className={badge}>Kamera {role === "in" ? "Masuk" : "Keluar"}</span> : <>
          <span className={badge}>{entryArrow} Masuk</span>
          <span className={badge}>{exitArrow} Keluar</span>
        </>}
        <span className={badge}>{twoLines ? "Lewati kedua batas untuk dihitung" : "Lewati garis untuk dihitung"}</span>
      </div>}
    </div>
  );
}
