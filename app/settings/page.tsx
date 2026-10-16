"use client";
import { useAccess } from "../../components/auth/access";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CCTVSettingsPanel from "../../components/settings/cctv-settings";
import GeneralSettingsPanel from "../../components/settings/general-settings";
import SyncSettings from "../../components/settings/sync-settings";
import ProfileSettings from "../../components/settings/profile-settings";
import { Page, PageHeading, Tabs } from "../../components/ui/layout";
import { ui } from "../../components/ui/styles";
function SettingsContent() {
  const { can, loading: accessLoading } = useAccess();
  const params = useSearchParams();
  const requested = params.get("tab");
  const tab =
    requested === "sync" || requested === "profile" || requested === "dashboard" || requested === "cctv"
      ? requested
      : can("settings.write") ? "system" : "profile";
  return (
    <Page>
      <PageHeading>
        <div>
          <p className="mb-1 text-xs/normal font-semibold text-navy">SISTEM</p>
          <h1>Pengaturan</h1>
          <p className={ui.pageDescription}>
            Kelola sistem kamera, profil pengguna, dan tampilan dashboard.
          </p>
        </div>
      </PageHeading>
      <Tabs aria-label="Kategori pengaturan">
        {[
          { id: "system", label: "Sistem Kamera" },
          { id: "profile", label: "Profil Saya" },
          { id: "dashboard", label: "Pengaturan Dashboard" },
          { id: "sync", label: "Sinkronisasi" },
        ].filter(({ id }) => id === "profile" || (id === "sync" ? can("sync.run") : can("settings.write"))).map(({ id, label }) => (
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
      </Tabs>
      {accessLoading ? <p role="status">Memuat hak akses…</p> : tab !== "profile" && !(tab === "sync" ? can("sync.run") : can("settings.write")) ? (
        <p role="alert">Anda tidak memiliki izin untuk mengubah pengaturan ini. Buka Profil Saya untuk mengelola profil Anda.</p>
      ) : tab === "sync" ? (
        <SyncSettings />
      ) : tab === "system" ? (
        <>
          <GeneralSettingsPanel />
        </>
      ) : tab === "cctv" ? (
        <CCTVSettingsPanel />
      ) : (
        <ProfileSettings key={tab} kind={tab} />
      )}
    </Page>
  );
}
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className={ui.page}>
          Memuat pengaturan…
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
