"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "../ui/styles";

export type StartupStatus = {
  state: string;
  message: string;
  error?: string | null;
  duration_ms?: number;
  stage_ms?: Record<string, number>;
};

type Step = { key: "models" | "camera" | "frame"; label: string };
const STEPS: Step[] = [
  { key: "models", label: "Memuat model AI" },
  { key: "camera", label: "Menghubungkan kamera" },
  { key: "frame", label: "Menunggu gambar pertama" },
];

/** Map backend startup states (and first-frame waiting) to a visible step. */
export function startupStep(startup: StartupStatus | null | undefined, waitingForFrame: boolean): number {
  if (startup && ["queued", "preparing_models"].includes(startup.state)) return 0;
  if (startup && ["connecting_camera", "restarting_camera"].includes(startup.state)) return 1;
  return waitingForFrame ? 2 : -1;
}

function stepDetail(step: number, startup: StartupStatus | null | undefined, seconds: number, cameraCount: number) {
  if (startup?.state === "queued") return "Menunggu giliran memuat model. Event lain mungkin sedang disiapkan.";
  if (step === 0) {
    return seconds >= 60
      ? "Pemuatan model masih berjalan. Jangan tutup aplikasi; Anda dapat membatalkan persiapan bila perlu."
      : "Model deteksi orang, wajah, dan pencocokan identitas dimuat ke memori. Start pertama setelah aplikasi dibuka paling lama; start berikutnya lebih cepat.";
  }
  if (step === 1) return startup?.state === "restarting_camera" ? startup.message : `Membuka stream video untuk ${cameraCount > 1 ? `${cameraCount} kamera` : "kamera"} event.`;
  return seconds >= 20
    ? "Gambar belum diterima. Periksa kamera menyala dan terhubung ke jaringan yang sama."
    : "Kamera terhubung. Menunggu gambar pertama sebelum penghitungan dimulai.";
}

function useElapsedSeconds(baseMs: number | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  const [base, setBase] = useState({ ms: baseMs ?? 0, at: Date.now() });
  useEffect(() => { setBase({ ms: baseMs ?? 0, at: Date.now() }); }, [baseMs]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return Math.max(0, Math.floor((base.ms + (active ? now - base.at : 0)) / 1000));
}

export function StartupProgress({ startup, waitingForFrame, cameraCount }: {
  startup: StartupStatus | null | undefined;
  waitingForFrame: boolean;
  cameraCount: number;
}) {
  const step = startupStep(startup, waitingForFrame);
  const seconds = useElapsedSeconds(startup?.duration_ms, step >= 0);
  if (step < 0) return null;
  const title = step === 2 ? "Menunggu gambar kamera" : startup?.message || "Menyiapkan monitoring";
  return (
    <section role="status" aria-live="polite" aria-label="Persiapan monitoring" className="mb-4 rounded-xl border border-[#d6e2f3] bg-white p-4 shadow-[0_1px_2px_#14264114] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Loader2 size={20} className="mt-0.5 shrink-0 animate-spin text-navy" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-[#101c30]">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#52647f]">{stepDetail(step, startup, seconds, cameraCount)}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#f0f4fb] px-2.5 py-1 text-xs font-medium tabular-nums text-navy">{seconds} detik</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e8eef6]" aria-hidden="true">
        <div className="relative h-full overflow-hidden rounded-full bg-linear-to-r from-navy to-[#22b8d8] transition-[width] duration-700" style={{ width: `${[30, 62, 88][step]}%` }}>
          <span className="absolute inset-0 animate-pulse bg-white/30 motion-reduce:animate-none" />
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {STEPS.map((item, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={item.key} className={cx("flex min-w-0 items-center gap-2", active ? "font-semibold text-navy" : done ? "text-[#101c30]" : "text-[#8a97ab]")} aria-current={active ? "step" : undefined}>
              <span className={cx("grid size-5 shrink-0 place-items-center rounded-full border-2", done ? "border-navy bg-navy text-white" : active ? "border-navy text-navy" : "border-[#cfd8e3]")}>
                {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : active ? <span className="size-2 animate-pulse rounded-full bg-navy motion-reduce:animate-none" /> : null}
              </span>
              <span className="min-w-0 leading-tight">{item.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Compact in-cell indicator while the camera grid has no video yet. */
export function CameraStartupPlaceholder({ startup, waitingForFrame }: { startup: StartupStatus | null | undefined; waitingForFrame: boolean }) {
  const step = startupStep(startup, waitingForFrame);
  if (step < 0) return null;
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-4 text-center" role="status">
      <Loader2 size={26} className="animate-spin text-cyan-300" aria-hidden="true" />
      <p className="text-xs font-medium text-slate-200">{step === 2 ? "Menunggu gambar kamera…" : startup?.message || "Menyiapkan monitoring"}</p>
      <p className="text-[11px] text-slate-400">Tahap {step + 1} dari {STEPS.length}</p>
    </div>
  );
}
