"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CCTVSettingsPanel from "../../components/settings/cctv-settings";
import GeneralSettingsPanel from "../../components/settings/general-settings";
import ProfileSettings from "../../components/settings/profile-settings";
import { Page, PageHeading, Tabs } from "../../components/ui/layout";
import { ButtonLink } from "../../components/ui/button";
import { ui } from "../../components/ui/styles";
function SettingsContent() {
  const params = useSearchParams();
  const requested = params.get("tab");
  const tab =
    requested === "profile" || requested === "dashboard" || requested === "cctv"
      ? requested
      : "system";
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
      </Tabs>
      {tab === "system" ? (
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
