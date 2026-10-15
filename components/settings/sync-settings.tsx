"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { visitorFetch } from "../auth/visitor-fetch";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";
import { ui } from "../ui/styles";

type Conflict = {
  entity: string; key: string; local_hash: string | null;
  remote_hash: string | null; choice: "local" | "server" | null;
};
type Status = {
  connected: boolean; server: string; running?: boolean; message?: string;
  last_success?: string | null; error?: string | null; conflicts: Conflict[];
  counts?: { uploaded: number; downloaded: number; conflicts: number };
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
        Hentikan monitoring di kedua sisi sebelum menyinkronkan perubahan.
      </p>
      <p className="mt-3 text-sm text-muted">
        Mencakup profil, workspace, dashboard, kamera, pengaturan, event, sesi, kunjungan,
        foto, tangkapan tertunda, dan koreksi. Rekaman video serta indeks pengenalan wajah
        disimpan terpisah dari database dan belum disinkronkan melalui fitur ini.
      </p>
      {(error || status?.error) && <p role="alert" className={ui.error}>{error || status?.error}</p>}
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
          <p role="status" aria-live="polite">{status.running ? status.message : status.message || "Siap disinkronkan"}</p>
          {status.counts && <p className="text-sm text-muted">
            {status.counts.uploaded} dikirim · {status.counts.downloaded} diterima · {status.counts.conflicts} konflik
          </p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled={disabled} onClick={() => void action(() => syncRequest("/run", "POST"))}>
              {status.running ? "Menyinkronkan…" : "Sinkronkan sekarang"}
            </Button>
            <Button disabled={disabled} onClick={() => void action(() => syncRequest("/connect", "DELETE"))}>
              Putuskan koneksi
            </Button>
          </div>
          <p className="text-sm text-muted">Jika sesi server kedaluwarsa, putuskan koneksi lalu hubungkan kembali. Data lokal tetap tersimpan.</p>
          {status.conflicts.length > 0 && (
            <div className="space-y-3">
              <h3>Perubahan yang perlu dipilih</h3>
              <p className="text-sm text-muted">Kedua sisi berubah sejak sinkronisasi terakhir. Pilih versi yang dipertahankan, lalu sinkronkan kembali.</p>
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
