"use client";

import { ButtonLink } from "../ui/button";
import { Panel } from "../ui/layout";
import { ui } from "../ui/styles";

export default function CCTVSettingsPanel() {
  return <Panel>
    <h2>Pengaturan kamera dan event</h2>
    <p className={ui.pageDescription}>Tambahkan atau uji sumber kamera di Master CCTV. Tentukan arah masuk dan keluar saat mengatur kamera dalam event.</p>
    <div className="mt-6 grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <h3 className="font-semibold">Sumber kamera</h3>
        <p className="text-sm text-neutral-600">Kelola nama kamera, alamat stream, atau kamera laptop. Uji tampilan sebelum digunakan.</p>
        <ButtonLink href="/master-cctv">Kelola kamera</ButtonLink>
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold">Penghitungan pengunjung</h3>
        <p className="text-sm text-neutral-600">Atur arah kamera, garis penghitungan, pengunjung duplikat, dan deteksi gender untuk setiap event.</p>
        <ButtonLink href="/events">Kelola event</ButtonLink>
      </div>
    </div>
  </Panel>;
}
