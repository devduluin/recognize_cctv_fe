"use client";

import { ArrowRight, CheckCircle2, ClipboardCheck, Eye, EyeOff, LayoutDashboard, ShieldCheck } from "lucide-react";
import { ReactNode, useState } from "react";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#eef2f6] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="hidden border-r border-slate-200 bg-slate-50 p-10 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white"><LayoutDashboard size={22} /></div>
            <div><p className="font-semibold tracking-tight text-slate-900">Vision Admin</p><p className="text-xs text-slate-500">Administrasi operasional</p></div>
          </div>
          <div className="mt-auto max-w-sm">
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"><ClipboardCheck size={21} /></div>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-900">Kelola pekerjaan harian dengan mudah.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Akses absensi, pengunjung, dan pengaturan operasional dari satu tempat.</p>
            <div className="mt-7 space-y-3 text-sm text-slate-600">
              <p className="flex items-center gap-3"><CheckCircle2 size={17} className="text-emerald-600" /> Data tersusun rapi</p>
              <p className="flex items-center gap-3"><CheckCircle2 size={17} className="text-emerald-600" /> Akses untuk kebutuhan tim</p>
              <p className="flex items-center gap-3"><ShieldCheck size={17} className="text-emerald-600" /> Keamanan akun terjaga</p>
            </div>
          </div>
          <p className="mt-12 text-xs text-slate-400">© 2026 Vision Admin</p>
        </aside>
        <section className="flex items-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><LayoutDashboard size={20} /></div><span className="font-semibold">Vision Admin</span></div>
            <div className="mb-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{subtitle}</p></div>
            {children}
            {footer && <div className="mt-8 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">{footer}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthField({ label, icon, type = "text", ...props }: { label: string; icon: ReactNode; type?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && visible ? "text" : type;
  return <div><label className="mb-2 block text-sm font-medium text-slate-700">{label}</label><div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">{icon}</span><input {...props} type={inputType} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10" />{isPassword && <button type="button" aria-label={visible ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-700">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}</div></div>;
}

export function AuthAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{children}</div>;
}

export function AuthSubmit({ children, loading }: { children: ReactNode; loading: boolean }) {
  return <button type="submit" disabled={loading} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-70">{children}{!loading && <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />}</button>;
}
