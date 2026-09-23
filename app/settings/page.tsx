"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CCTVSettingsPanel from "../../components/settings/cctv-settings";
import GeneralSettingsPanel from "../../components/settings/general-settings";
import ProfileSettings from "../../components/settings/profile-settings";
function SettingsContent() {
  const params = useSearchParams();
  const requested = params.get("tab");
  const tab =
    requested === "profile" || requested === "dashboard" || requested === "cctv"
      ? requested
      : "system";
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SISTEM</p>
          <h1>Pengaturan</h1>
          <p className="page-description">
            Kelola sistem kamera, profil pengguna, dan tampilan dashboard.
          </p>
        </div>
      </div>
      <nav aria-label="Kategori pengaturan" className="settings-tabs">
        {[
          { id: "system", label: "Sistem Kamera" },
          { id: "profile", label: "Pengaturan Pengguna" },
          { id: "dashboard", label: "Pengaturan Dashboard" },
        ].map(({ id, label }) => (
          <Link
            key={id}
            href={`/settings?tab=${id}`}
            scroll={false}
            aria-current={
              tab === id || (tab === "cctv" && id === "system")
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "system" ? (
        <>
          <GeneralSettingsPanel />
          <Link className="btn mt-4" href="/settings?tab=cctv">
            Konfigurasi kamera & aturan absensi
          </Link>
        </>
      ) : tab === "cctv" ? (
        <CCTVSettingsPanel />
      ) : (
        <ProfileSettings key={tab} kind={tab} />
      )}
    </main>
  );
}
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="page">
          Memuat pengaturan…
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
