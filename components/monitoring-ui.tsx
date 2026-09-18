import type { LucideIcon } from "lucide-react";

export const monitorPanel = "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm";
export const monitorButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function MetricCard({ label, value, detail, icon: Icon, tone = "indigo" }: {
  label: string; value: string | number; detail: string; icon: LucideIcon;
  tone?: "indigo" | "emerald" | "amber" | "sky";
}) {
  const colors = { indigo: "bg-indigo-50 text-indigo-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", sky: "bg-sky-50 text-sky-600" };
  return (
    <div className={`${monitorPanel} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}><Icon size={19} /></span></div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{detail}</p>
    </div>
  );
}

export function MonitorStatus({ label, running = false, error = false }: { label: string; running?: boolean; error?: boolean }) {
  return <span role="status" className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${error ? "border-red-200 bg-red-50 text-red-700" : running ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${error ? "bg-red-500" : running ? "bg-emerald-500" : "bg-slate-400"}`} />{label}</span>;
}
