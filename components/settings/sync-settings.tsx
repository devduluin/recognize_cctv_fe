"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { visitorFetch } from "../auth/visitor-fetch";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/field";
import { ui } from "../ui/styles";

type Conflict = {
  entity: string; key: string; local_hash: string | null;
  remote_hash: string | null; choice: "local" | "server" | null;
};
type Status = {
  connected: boolean; server: string; running?: boolean; message?: string;
  auto_sync: boolean; interval_seconds: number; auth_required?: boolean;
  next_retry?: string | null; connection_state?: string;
  last_success?: string | null; error?: string | null; conflicts: Conflict[];
  counts?: { uploaded: number; downloaded: number; conflicts: number; deferred?: number };
};
const labels: Record<string, string> = {
  company: "Workspace", profile: "Profil", dashboard: "Dashboard", cameras: "Kamera",
  workspace_settings: "Pengaturan workspace", visitor_settings: "Pengaturan pengunjung",
  events: "Event", sessions: "Sesi", visits: "Kunjungan", pending_captures: "Tangkapan tertunda",
  corrections: "Koreksi pengunjung",
};
const base = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/sync`;

async function syncRequest<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await visitorFetch(`${base}${path}`, {
    method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(
    typeof payload?.detail === "string" ? payload.detail
      : typeof payload?.message === "string" ? payload.message : "Sinkronisasi belum dapat diproses.",
  );
  return payload as T;
}

export default function SyncSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [server, setServer] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    const next = await syncRequest<Status>("/status");
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await syncRequest<Status>("/status");
        if (active) { setStatus(next); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Status belum dapat dimuat.");
      } finally {
        if (active) timer = setTimeout(poll, 3000);
      }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, []);

  async function action(task: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await task(); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Permintaan gagal."); }
    finally { setBusy(false); }
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credentials = { server, email, password };
    setPassword("");
    await action(() => syncRequest("/connect", "POST", credentials));
  }

  const disabled = busy || status?.running;
  return (
    <section className={ui.panel} aria-labelledby="sync-title">
      <h2 id="sync-title">Sinkronisasi database</h2>
      <p className={ui.pageDescription}>
        Kirim dan ambil perubahan workspace saat online. Data tetap tersedia saat offline.
        Gunakan akun server dengan email dan tipe akun yang sama dengan akun desktop.
        Jalankan secara manual atau aktifkan sinkronisasi otomatis sesuai periode yang dipilih.
        Perubahan yang belum terkirim tetap tersimpan saat offline.
      </p>
      <p className="mt-3 text-sm text-muted">
        Mencakup profil, workspace, dashboard, kamera, pengaturan, event, sesi, kunjungan,
        foto, tangkapan tertunda, dan koreksi. Rekaman video serta indeks pengenalan wajah
        disimpan terpisah dari database dan belum disinkronkan melalui fitur ini.
      </p>
      {(error || (status?.error && status.connection_state !== "offline")) && <p role="alert" className={ui.error}>{error || status?.error}</p>}
      {!status?.connected ? (
        <form onSubmit={connect} className="mt-5 grid max-w-xl gap-4">
          <Field>URL API server
            <Input type="url" required value={server} placeholder="https://api.example.com"
              onChange={event => setServer(event.target.value)} disabled={busy} />
          </Field>
          <Field>Email akun server
            <Input type="email" autoComplete="username" required value={email}
              onChange={event => setEmail(event.target.value)} disabled={busy} />
          </Field>
          <Field>Password akun server
            <Input type="password" autoComplete="current-password" required value={password}
              onChange={event => setPassword(event.target.value)} disabled={busy} />
          </Field>
          <Button type="submit" variant="primary" disabled={busy || !status}>
            {busy ? "Menghubungkan…" : "Hubungkan server"}
          </Button>
        </form>
      ) : (
        <div className="mt-5 space-y-4">
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-muted">Server</dt><dd className="break-all">{status.server}</dd></div>
            <div><dt className="text-muted">Terakhir selesai</dt>
              <dd>{status.last_success ? new Date(status.last_success).toLocaleString("id-ID") : "Belum pernah"}</dd>
            </div>
          </dl>
          <fieldset disabled={disabled} className="flex flex-wrap items-center gap-4">
            <legend className="sr-only">Pengaturan sinkronisasi otomatis</legend>
            <Field>Mode sinkronisasi
              <Select value={status.auto_sync ? "automatic" : "manual"}
                onChange={event => void action(() => syncRequest("/settings", "PATCH", { auto_sync: event.target.value === "automatic", interval_seconds: status.interval_seconds }))}>
                <option value="manual">Manual saja</option>
                <option value="automatic">Manual + otomatis</option>
              </Select>
            </Field>
            <Field>Periode sinkronisasi otomatis
              <Select disabled={!status.auto_sync} value={status.interval_seconds} onChange={event => void action(() => syncRequest("/settings", "PATCH", { auto_sync: status.auto_sync, interval_seconds: Number(event.target.value) }))}>
                <option value={15}>15 detik</option><option value={30}>30 detik</option>
                <option value={60}>1 menit</option><option value={300}>5 menit</option>
                <option value={600}>10 menit</option><option value={900}>15 menit</option>
                <option value={1800}>30 menit</option><option value={3600}>1 jam</option>
                {![15, 30, 60, 300, 600, 900, 1800, 3600].includes(status.interval_seconds) && <option value={status.interval_seconds}>{status.interval_seconds} detik</option>}
              </Select>
            </Field>
          </fieldset>
          <p className="text-sm text-muted">
            {status.auto_sync
              ? "Sinkronisasi otomatis berjalan di latar belakang selama aplikasi terbuka. Periode dihitung setelah proses sebelumnya selesai. Anda juga dapat menekan Sinkronkan sekarang."
              : "Sinkronisasi hanya berjalan saat Anda menekan Sinkronkan sekarang. Periode pilihan tetap tersimpan saat mode otomatis dimatikan."}
          </p>
          <p role="status" aria-live="polite">{status.auth_required ? "Sesi sinkronisasi perlu dihubungkan ulang." : status.connection_state === "offline"
            ? (status.auto_sync ? "Server belum terhubung. Data tetap disimpan lokal dan akan dicoba lagi otomatis." : "Server belum terhubung. Data tetap disimpan lokal. Tekan Sinkronkan sekarang untuk mencoba lagi.")
            : !status.auto_sync && !status.running ? "Mode manual aktif. Sinkronisasi otomatis tidak berjalan." : status.message || "Menunggu sinkronisasi otomatis"}</p>
          {status.auto_sync && status.next_retry && !status.running && !status.auth_required && <p className="text-sm text-muted">
            Pemeriksaan berikutnya: {new Date(status.next_retry).toLocaleTimeString("id-ID")}.
          </p>}
          {status.counts && <p className="text-sm text-muted">
            {status.counts.uploaded} dikirim · {status.counts.downloaded} diterima · {status.counts.conflicts} konflik · {status.counts.deferred || 0} ditunda
          </p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={disabled} onClick={() => void action(() => syncRequest("/run", "POST"))}>
              {status.running ? "Menyinkronkan…" : "Sinkronkan sekarang"}
            </Button>
            <Button disabled={disabled} onClick={() => void action(() => syncRequest("/connect", "DELETE"))}>
              Putuskan koneksi
            </Button>
          </div>
          {!!status.counts?.deferred && <p className="text-sm text-muted">Hasil hitung baru tetap dapat disinkronkan saat monitoring. Perubahan konfigurasi, koreksi, dan penghapusan yang ditunda akan dicoba setelah monitoring berhenti.</p>}
          <p className="text-sm text-muted">Jika sesi server kedaluwarsa, putuskan koneksi lalu hubungkan kembali. Data lokal tetap tersimpan.</p>
          {status.conflicts.length > 0 && (
            <div className="space-y-3">
              <h3>Perubahan yang perlu dipilih</h3>
              <p className="text-sm text-muted">Kedua sisi berubah sejak sinkronisasi terakhir. Pilih versi yang dipertahankan. Sinkronisasi berikutnya akan menerapkan pilihan tersebut.</p>
              <ul className="space-y-3">
                {status.conflicts.map(conflict => <li key={`${conflict.entity}:${conflict.key}`} className="border-b border-line pb-3">
                  <p className="text-sm">{labels[conflict.entity] || conflict.entity} · <span className="break-all">{conflict.key}</span></p>
                  <p className="text-xs text-muted">
                    Desktop: {conflict.local_hash ? "ada perubahan" : "dihapus"} · Server: {conflict.remote_hash ? "ada perubahan" : "dihapus"}
                    {conflict.choice && ` · Pilihan: ${conflict.choice === "local" ? "desktop" : "server"}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["local", "server"] as const).map(choice => <Button key={choice} disabled={disabled}
                      onClick={() => void action(() => syncRequest("/resolve", "POST", { ...conflict, choice }))}>
                      Gunakan versi {choice === "local" ? "desktop" : "server"}
                    </Button>)}
                  </div>
                </li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
