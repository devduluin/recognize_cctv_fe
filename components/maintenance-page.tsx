"use client";

import { useState } from "react";
import { RefreshCw, ShieldCheck, Database, Camera } from "lucide-react";
import { BrandLogo } from "./ui/brand-logo";
import { defaultDashboardProfile } from "./dashboard-profile";

export default function MaintenancePage() {
  const [isChecking, setIsChecking] = useState(false);

  const handleRefresh = () => {
    setIsChecking(true);
    window.location.reload();
  };

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-[#f3f5f9] p-4 text-slate-900 sm:p-8">
      {/* Top Navbar */}
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <BrandLogo name={defaultDashboardProfile.name} src="" size="sidebar" />
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {defaultDashboardProfile.name}
            </p>
            <p className="text-xs text-slate-500">Dashboard Monitoring CCTV</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono font-medium text-slate-700 shadow-2xs">
          <span className="size-1.5 rounded-full bg-amber-500" />
          MAINTENANCE
        </span>
      </header>

      {/* Main Content Card */}
      <main className="mx-auto my-auto w-full max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_-20px_rgba(15,23,42,0.12)]">
          <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-8 sm:px-10">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Pemberitahuan Sistem
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Pemeliharaan Sistem Terjadwal
            </h1>
            <p className="mt-3 text-sm text-slate-600 sm:text-base leading-relaxed">
              Akses ke dashboard dan pengolahan stream kamera dinonaktifkan sementara waktu untuk
              pemeliharaan infrastruktur dan sinkronisasi basis data.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-10">
            {/* Impact Table */}
            <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Status Operasional
            </h2>
            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between p-3.5 text-xs sm:text-sm">
                <span className="flex items-center gap-2.5 font-medium text-slate-700">
                  <Camera className="size-4 text-slate-400" />
                  Stream & Deteksi CCTV
                </span>
                <span className="font-medium text-amber-700">Ditangguhkan</span>
              </div>
              <div className="flex items-center justify-between p-3.5 text-xs sm:text-sm">
                <span className="flex items-center gap-2.5 font-medium text-slate-700">
                  <Database className="size-4 text-slate-400" />
                  Database & Logging Event
                </span>
                <span className="font-medium text-amber-700">Sinkronisasi</span>
              </div>
              <div className="flex items-center justify-between p-3.5 text-xs sm:text-sm">
                <span className="flex items-center gap-2.5 font-medium text-slate-700">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  Integritas Data Tersimpan
                </span>
                <span className="font-medium text-emerald-700">Aman & Terarsip</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
              <p className="text-xs text-slate-500">
                Layanan akan otomatis kembali normal setelah proses pemeliharaan selesai.
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isChecking}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-75 sm:w-auto"
              >
                <RefreshCw className={`size-3.5 ${isChecking ? "animate-spin" : ""}`} />
                {isChecking ? "Memeriksa..." : "Periksa Ulang Halaman"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-2xl text-center text-xs text-slate-400">
        Jika Anda memerlukan akses darurat, silakan hubungi tim administrator sistem server.
      </footer>
    </div>
  );
}
