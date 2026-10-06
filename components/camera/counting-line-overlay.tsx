"use client";

export interface LineConfig {
  linePosition?: number;
  lineOrientation?: "horizontal" | "vertical" | string;
  lineAngle?: number;
  reverseDirection?: boolean;
  twoLineCounting?: boolean;
  zoneWidthRatio?: number;
  mirror?: boolean;
  countingDirection?: "in" | "out" | "auto" | string;
}

export interface CountingLineOverlayProps {
  config?: LineConfig;
  showLabels?: boolean;
  className?: string;
}

export default function CountingLineOverlay({ config, showLabels = true, className = "" }: CountingLineOverlayProps) {
  if (!config) return null;
  const normalize = (value: number) => value > 1 ? value / 100 : value;
  const position = Math.max(0.05, Math.min(0.95, normalize(config.linePosition ?? 0.5)));
  const width = Math.max(0.02, Math.min(0.5, normalize(config.zoneWidthRatio ?? 0.2)));
  const vertical = config.lineOrientation === "vertical";
  const twoLines = config.twoLineCounting ?? true;
  const boundaries = twoLines ? [Math.max(0, position - width / 2), Math.min(1, position + width / 2)] : [position];
  const backwards = Boolean(config.reverseDirection) !== (vertical && Boolean(config.mirror));
  const entryArrow = vertical ? backwards ? "←" : "→" : backwards ? "↑" : "↓";
  const exitArrow = vertical ? backwards ? "→" : "←" : backwards ? "↓" : "↑";
  const role = config.countingDirection;
  const badge = "rounded-md bg-slate-950/90 px-2 py-1 text-xs font-medium text-white";
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`} aria-hidden="true">
      <div className={`absolute inset-0 ${config.mirror ? "-scale-x-100" : ""}`}>
        {twoLines && <div className="absolute bg-cyan-300/10" style={vertical
          ? { top: 0, bottom: 0, left: `${boundaries[0] * 100}%`, width: `${(boundaries[1] - boundaries[0]) * 100}%` }
          : { left: 0, right: 0, top: `${boundaries[0] * 100}%`, height: `${(boundaries[1] - boundaries[0]) * 100}%` }} />}
        {boundaries.map((value, index) => (
          <div key={index} className={`absolute bg-cyan-300 ${vertical ? "inset-y-0 w-0.5" : "inset-x-0 h-0.5"}`}
            style={vertical ? { left: `${value * 100}%` } : { top: `${value * 100}%` }}>
            {showLabels && <span className={`absolute ${badge} ${vertical ? "left-1 top-2" : "left-2 -top-3"} ${config.mirror ? "-scale-x-100" : ""}`}>
              {twoLines ? `Batas ${index + 1}` : "Garis hitung"}
            </span>}
          </div>
        ))}
      </div>
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
