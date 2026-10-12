import type { LineConfig } from "./counting-line-overlay";

export type Point = { x: number; y: number };

export function countingLineGuidance(config: LineConfig) {
  const entryOrder = config.reverseDirection ? "Batas 2 ke Batas 1" : "Batas 1 ke Batas 2";
  const exitOrder = config.reverseDirection ? "Batas 1 ke Batas 2" : "Batas 2 ke Batas 1";
  const twoLines = config.twoLineCounting ?? true;
  const entry = twoLines ? `Masuk: ${entryOrder}` : "Masuk: lewati garis mengikuti panah";
  const exit = twoLines ? `Keluar: ${exitOrder}` : "Keluar: lewati garis mengikuti panah";
  return config.countingDirection === "in" ? [entry]
    : config.countingDirection === "out" ? [exit]
    : [entry, exit];
}

export function containedVideoRect(containerWidth: number, containerHeight: number, mediaWidth: number, mediaHeight: number) {
  if (Math.min(containerWidth, containerHeight, mediaWidth, mediaHeight) <= 0) return null;
  const scale = Math.min(containerWidth / mediaWidth, containerHeight / mediaHeight);
  const width = mediaWidth * scale;
  const height = mediaHeight * scale;
  return { left: (containerWidth - width) / 2, top: (containerHeight - height) / 2, width, height };
}

export function countingLineGeometry(width: number, height: number, config: LineConfig) {
  const normalize = (value: number) => value > 1 ? value / 100 : value;
  const position = Math.max(0, Math.min(1, normalize(config.linePosition ?? 0.5)));
  const zone = Math.max(0.02, Math.min(0.5, normalize(config.zoneWidthRatio ?? 0.2)));
  const vertical = config.lineOrientation === "vertical";
  const axis = vertical ? width : height;
  const center = Math.floor(axis * position);
  const half = Math.max(1, Math.floor(axis * zone / 2));
  const angle = (config.lineAngle ?? 0) * Math.PI / 180;
  const normal = vertical ? { x: Math.cos(angle), y: Math.sin(angle) } : { x: -Math.sin(angle), y: Math.cos(angle) };
  const anchor = vertical ? { x: width * position, y: height / 2 } : { x: width / 2, y: height * position };
  const offsets = (config.twoLineCounting ?? true)
    ? [Math.max(0, center - half) - center, Math.min(axis - 1, center + half) - center]
    : [0];
  const span = 2 * Math.hypot(width, height);
  const display = (point: Point) => config.mirror ? { x: width - 1 - point.x, y: point.y } : point;
  const lines = offsets.map((offset) => {
    const x = anchor.x + normal.x * offset;
    const y = anchor.y + normal.y * offset;
    const start = display({ x: Math.round(x - normal.y * span), y: Math.round(y + normal.x * span) });
    const end = display({ x: Math.round(x + normal.y * span), y: Math.round(y - normal.x * span) });
    const intersections: Point[] = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx !== 0) for (const edgeX of [0, width - 1]) {
      const edgeY = start.y + (edgeX - start.x) * dy / dx;
      if (edgeY >= 0 && edgeY <= height - 1) intersections.push({ x: edgeX, y: edgeY });
    }
    if (dy !== 0) for (const edgeY of [0, height - 1]) {
      const edgeX = start.x + (edgeY - start.y) * dx / dy;
      if (edgeX >= 0 && edgeX <= width - 1) intersections.push({ x: edgeX, y: edgeY });
    }
    intersections.sort((a, b) => vertical ? a.y - b.y : a.x - b.x);
    return { start, end, labelPoint: intersections[0], offset };
  });
  const forward = config.reverseDirection ? -1 : 1;
  const direction = { x: normal.x * forward * (config.mirror ? -1 : 1), y: normal.y * forward };
  const entryArrow = Math.abs(direction.x) > Math.abs(direction.y)
    ? direction.x > 0 ? "→" : "←" : direction.y > 0 ? "↓" : "↑";
  const exitArrow = ({ "→": "←", "←": "→", "↓": "↑", "↑": "↓" } as const)[entryArrow];
  return { lines, entryArrow, exitArrow };
}
