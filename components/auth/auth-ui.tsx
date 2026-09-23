"use client";

import { CalendarDays, Check, CircleAlert, Eye, EyeOff, Loader2, Users, Video, type LucideIcon } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { BrandLogo } from "../ui/brand-logo";
import { defaultDashboardProfile } from "../dashboard-profile";
import { cx } from "../ui/styles";

export const authLinkClass = "font-semibold text-navy underline-offset-4 hover:underline focus-visible:rounded-sm";

function AuthBrand() {
  return (
    <div className="flex items-center gap-3">
      <BrandLogo name={defaultDashboardProfile.name} src="" size="sidebar" />
      <div>
        <p className="text-base font-semibold">{defaultDashboardProfile.name}</p>
        <p className="mt-0.5 text-xs text-inherit opacity-80">Dashboard Monitoring</p>
      </div>
    </div>
  );
}

export function AuthShell({ eyebrow, title, subtitle, children, footer, step }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
  footer?: ReactNode;
  step?: 1 | 2;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f3f5f9] p-4 text-foreground sm:p-8 lg:p-10">
      <div className="grid w-full max-w-[1120px] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_12px_40px_-24px_#0c2e7340] lg:min-h-[720px] lg:grid-cols-[0.9fr_1.1fr] lg:rounded-3xl">
        <aside className="hidden flex-col justify-between bg-navy p-10 text-white lg:flex xl:p-12">
          <AuthBrand />
          <div className="py-14">
            <p className="mb-5 text-sm font-medium text-[#cbd8f0]">Kamera, event, dan pengunjung</p>
            <h2 className="max-w-sm text-[38px] leading-[1.18] font-semibold tracking-tight">
              Operasional Anda,<br />dalam satu tampilan.
            </h2>
            <p className="mt-5 max-w-xs text-sm leading-6 text-[#d9e3f5]">
              Pantau kamera, atur jadwal event, dan lihat arus pengunjung dari workspace Anda.
            </p>
            <div className="mt-10 space-y-5 border-t border-white/20 pt-7">
              {[
                { icon: Video, title: "Monitoring kamera", description: "Akses preview dan status kamera." },
                { icon: CalendarDays, title: "Manajemen event", description: "Atur jadwal dan kamera untuk setiap event." },
                { icon: Users, title: "Statistik pengunjung", description: "Lihat kunjungan dan distribusi per jam." },
              ].map(({ icon: Icon, title: label, description }) => (
                <div key={label} className="flex items-start gap-3.5">
                  <Icon size={19} className="mt-0.5 shrink-0 text-[#cbd8f0]" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#cbd8f0]">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-[#cbd8f0]">Workspace untuk operasional CCTV Anda.</p>
        </aside>

        <section className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12 lg:px-12 xl:px-16">
          <div className="mb-10 text-navy lg:hidden"><AuthBrand /></div>
          <div className="mx-auto w-full max-w-[420px]">
            {step && <AuthSteps step={step} />}
            <header className="mb-8">
              <p className="mb-3 text-sm font-medium text-muted">{eyebrow}</p>
              <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-foreground sm:text-[32px]">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p>
            </header>
            {children}
            {footer && <div className="mt-7 border-t border-line pt-6 text-center text-sm leading-6 text-muted">{footer}</div>}
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthSteps({ step }: { step: 1 | 2 }) {
  return (
    <ol aria-label="Tahap pendaftaran" className="mb-8 flex items-center gap-3 text-xs">
      {["Akun", "Workspace"].map((label, index) => (
        <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={cx("flex items-center gap-2", step >= index + 1 ? "font-semibold text-navy" : "text-muted")}>
          {index > 0 && <span aria-hidden="true" className="mr-1 h-px w-7 bg-line" />}
          <span className={cx("grid size-6 place-items-center rounded-full border", step >= index + 1 ? "border-navy bg-navy text-white" : "border-[#7b8ba3] bg-white")}>
            {step > index + 1 ? <Check size={13} aria-label="Selesai" /> : index + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function AuthField({ label, icon, type = "text", id, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">{icon}</span>
        <input
          {...props}
          id={inputId}
          type={isPassword && visible ? "text" : type}
          aria-describedby={[props["aria-describedby"], hint ? `${inputId}-hint` : undefined].filter(Boolean).join(" ") || undefined}
          className={cx("h-12 w-full rounded-lg border border-[#7b8ba3] bg-white pl-11 text-base text-foreground transition-colors placeholder:text-[#65758b] focus:border-navy focus:outline-2 focus:outline-offset-2 focus:outline-navy disabled:cursor-not-allowed disabled:bg-slate-50 sm:text-sm", isPassword ? "pr-12" : "pr-3", className)}
        />
        {isPassword && (
          <button type="button" disabled={props.disabled} aria-label={visible ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={visible} aria-controls={inputId} onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-muted hover:text-navy">
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && <p id={`${inputId}-hint`} className="mt-2 text-xs leading-5 text-muted">{hint}</p>}
    </div>
  );
}

export function AuthAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" }) {
  const Icon = tone === "success" ? Check : CircleAlert;
  return (
    <div role={tone === "success" ? "status" : "alert"} className={cx("flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm leading-6", tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function AuthSubmit({ children, loading, loadingLabel = "Memproses…" }: { children: ReactNode; loading: boolean; loadingLabel?: string }) {
  return (
    <button type="submit" disabled={loading} aria-busy={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#17448c] disabled:cursor-wait disabled:opacity-70">
      {loading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /><span role="status">{loadingLabel}</span></> : children}
    </button>
  );
}

export function AccountChoice({ value, label, description, icon: Icon, checked, onChange, disabled }: {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label className={cx("relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-navy", checked ? "border-navy bg-[#f0f4fb]" : "border-[#7b8ba3] bg-white hover:bg-slate-50", disabled && "cursor-wait opacity-60")}>
      <Icon size={21} className="mt-0.5 shrink-0 text-navy" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#52647f]">{description}</span>
      </span>
      <input type="radio" name="account_type" value={value} checked={checked} onChange={onChange} disabled={disabled} className="mt-1 size-4 shrink-0 accent-navy" />
    </label>
  );
}
