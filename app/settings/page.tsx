"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, Settings2 } from "lucide-react";
import CCTVSettingsPanel from "../../components/settings/cctv-settings";
import GeneralSettingsPanel from "../../components/settings/general-settings";
import { User } from "lucide-react";

function SettingsContent() {
  const params = useSearchParams();
  const tab = params.get("tab") === "cctv" ? "cctv" : "general";
  const tabHref = (value: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("tab", value);
    return `/settings?${query.toString()}`;
  };

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
      <div className="mb-7 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600"><Settings2 size={23} /></span>
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">{process.env.NEXT_PUBLIC_APP_MODE === "single_tenant" ? "App Settings" : "Workspace Settings"}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pengaturan {process.env.NEXT_PUBLIC_APP_MODE === "single_tenant" ? "Sistem" : "Ruang Kerja"}</h1><p className="mt-2 text-sm text-slate-500">Kelola informasi profil, sistem AI, dan kamera CCTV dalam satu tempat.</p></div>
      </div>

      <nav aria-label="Kategori pengaturan" className="mb-8 flex flex-wrap gap-2 border-b border-slate-200 pb-5">
        {[
          { id: "general", label: "Pengaturan Umum", icon: User },
          { id: "cctv", label: "Kamera & Area CCTV", icon: Camera }
        ].map(({ id, label, icon: Icon }) => (
          <Link key={id} href={tabHref(id)} scroll={false} aria-current={tab === id ? "page" : undefined} className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-colors ${tab === id ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"}`}><Icon size={18} />{label}</Link>
        ))}
      </nav>

      <div className="mt-4">
        {tab === "general" ? <GeneralSettingsPanel /> : <CCTVSettingsPanel />}
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<div role="status" className="px-8 py-12 text-sm text-slate-500">Memuat pengaturan…</div>}><SettingsContent /></Suspense>;
}
