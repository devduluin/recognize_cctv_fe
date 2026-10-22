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
type ConflictDetail = { local_hash?: string | null; remote_hash?: string | null; label: string; local_deleted: boolean; server_deleted: boolean; protected_fields: number;
  fields: { field: string; local: unknown; server: unknown }[] };
type Device = { id: string; name: string; created_at: string; expires_at: string; last_used_at?: string; revoked: boolean };
type SyncHistory = { id: string; started_at: string; finished_at?: string; trigger: string; outcome: string; error_code?: number;
  counts: { uploaded?: number; downloaded?: number; conflicts?: number; deferred?: number } };
type Status = {
  transport?: "api" | "postgresql";
  conflicts_total?: number; history?: SyncHistory[]; complete?: boolean; last_complete?: string; device_expires_at?: string;
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

async function syncRequest<T>(path: string, method = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  const response = await visitorFetch(`${base}${path}`, {
    method, signal, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(
    typeof payload?.detail === "string" ? payload.detail
      : typeof payload?.message === "string" ? payload.message : "Sinkronisasi belum dapat diproses.",
  ), { status: response.status });
  return payload as T;
}

export default function SyncSettings() {
  const [webMode, setWebMode] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [details, setDetails] = useState<Record<string, ConflictDetail>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [deviceName, setDeviceName] = useState("Visitor Counter Desktop");
  const [server, setServer] = useState("");
  const [transport, setTransport] = useState<"api" | "postgresql">("postgresql");
  const [database, setDatabase] = useState({ host: "127.0.0.1", port: 5432, database: "", username: "", password: "", schema_name: "public", ssl_root_cert: "" });
  const updateDatabase = (key: keyof typeof database, value: string | number) => setDatabase(previous => ({ ...previous, [key]: value }));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pollError, setPollError] = useState("");
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    const next = await syncRequest<Status>("/status");
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let desktop = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (!desktop) {
          const result = await syncRequest<{ devices: Device[] }>("/devices", "GET", undefined, controller.signal);
          if (active) { setDevices(result.devices); setPollError(""); }
          return;
        }
        const next = await syncRequest<Status>("/status", "GET", undefined, controller.signal);
        if (active) { setStatus(next); setPollError(""); }
      } catch (cause) {
        if (active && cause instanceof Error && "status" in cause && cause.status === 404) {
          desktop = false;
          setWebMode(true);
          try {
            const result = await syncRequest<{ devices: Device[] }>("/devices", "GET", undefined, controller.signal);
            if (active) { setDevices(result.devices); setPollError(""); }
          } catch (deviceError) { if (active) setPollError(deviceError instanceof Error ? deviceError.message : "Daftar perangkat gagal dimuat."); }
          return;
        }
        if (active) setPollError(cause instanceof Error ? cause.message : "Status belum dapat dimuat.");
      } finally {
        if (active) timer = setTimeout(poll, desktop ? 3000 : 30000);
      }
    }
    void poll();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, []);

  async function action(task: () => Promise<unknown>) {
    setBusy(true); setError("");
    try {
      await task();
      if (webMode) setDevices((await syncRequest<{ devices: Device[] }>("/devices")).devices);
      else await reload();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Permintaan gagal."); }
    finally { setBusy(false); }
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTransport = status?.connected ? status.transport || "api" : transport;
    const credentials = selectedTransport === "postgresql"
      ? { database, email, password, device_name: deviceName }
      : { server: server || status?.server || "", email, password, device_name: deviceName };
    setPassword("");
    setDatabase(previous => ({ ...previous, password: "" }));
    await action(() => syncRequest(selectedTransport === "postgresql" ? "/connect-postgres" : "/connect", "POST", credentials));
  }

  const disabled = busy || status?.running;
  return (
    <section className={ui.panel} aria-labelledby="sync-title">
      <h2 id="sync-title">Sinkronisasi database</h2>
      <p className={ui.pageDescription}>
        Kirim dan ambil perubahan workspace saat online. Data tetap tersedia saat offline.
        Saat pertama menghubungkan, gunakan email dan tipe akun yang sama. Setelah terhubung,
        perangkat terikat ke ID akun dan workspace server, sehingga perubahan email tidak memutus sync.
        Jalankan secara manual atau aktifkan sinkronisasi otomatis sesuai periode yang dipilih.
        Perubahan yang belum terkirim tetap tersimpan saat offline.
      </p>
      <p className="mt-3 text-sm text-muted">
        Mencakup profil, workspace, dashboard, kamera, pengaturan, event, sesi, kunjungan,
        foto, tangkapan tertunda, dan koreksi. Rekaman video serta indeks pengenalan wajah
        disimpan terpisah dari database dan belum disinkronkan melalui fitur ini.
      </p>
      {(error || pollError || (status?.error && status.connection_state !== "offline")) && <p role="alert" className={ui.error}>{error || pollError || status?.error}</p>}
      {webMode ? <div className="mt-5 space-y-4">
        <h3>Perangkat tersambung ke akun Anda</h3>
        <p className="text-sm text-muted">Pengaturan periode dilakukan di aplikasi desktop. Cabut akses perangkat di sini untuk menghentikan sinkronisasinya. Pencabutan berlaku saat perangkat menghubungi server; data offline tidak terhapus.</p>
        {!devices.length && <p>Belum ada perangkat terhubung.</p>}
        <ul className="space-y-3">{devices.map(device => <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div><p>{device.name} · {device.id.slice(0, 8)}</p><p className="text-sm text-muted">{device.revoked ? "Akses dicabut" : `Berlaku hingga ${new Date(device.expires_at).toLocaleString("id-ID")}`} · Terakhir aktif: {device.last_used_at ? new Date(device.last_used_at).toLocaleString("id-ID") : "Belum digunakan"}</p></div>
          <Button disabled={busy || device.revoked} onClick={() => void action(() => syncRequest(`/devices/${encodeURIComponent(device.id)}`, "DELETE"))}>Cabut akses</Button>
        </li>)}</ul>
      </div> : !status?.connected ? (
        <form onSubmit={connect} className="mt-5 grid max-w-xl gap-4">
          <Field label="Jenis koneksi">
            <Select value={transport} onChange={event => setTransport(event.target.value as "api" | "postgresql")} disabled={busy}>
              <option value="postgresql">PostgreSQL langsung</option>
              <option value="api">API backend</option>
            </Select>
          </Field>
          <Field label="Nama perangkat">
            <Input required maxLength={100} value={deviceName} onChange={event => setDeviceName(event.target.value)} disabled={busy} placeholder="Contoh: Komputer pintu masuk" />
          </Field>
          {transport === "api" ? <Field label="URL API server">
            <Input type="url" required value={server} placeholder="https://api.example.com"
              onChange={event => setServer(event.target.value)} disabled={busy} />
          </Field> : <>
            <p className="text-sm text-muted">Terhubung langsung ke PostgreSQL tanpa menjalankan backend web. SQLite lokal tetap digunakan saat offline. Gunakan alamat komputer yang menjalankan Docker dan port PostgreSQL yang dipublikasikan.</p>
            <Field label="Host PostgreSQL"><Input required maxLength={253} value={database.host} onChange={event => updateDatabase("host", event.target.value)} disabled={busy} placeholder="127.0.0.1 atau db.example.com" /></Field>
            <Field label="Port PostgreSQL"><Input required type="number" min={1} max={65535} value={database.port} onChange={event => updateDatabase("port", Number(event.target.value))} disabled={busy} /></Field>
            <Field label="Nama database"><Input required maxLength={63} value={database.database} onChange={event => updateDatabase("database", event.target.value)} disabled={busy} /></Field>
            <Field label="Username database"><Input required maxLength={63} autoComplete="off" value={database.username} onChange={event => updateDatabase("username", event.target.value)} disabled={busy} /></Field>
            <Field label="Password database"><Input required type="password" autoComplete="off" value={database.password} onChange={event => updateDatabase("password", event.target.value)} disabled={busy} /></Field>
            <Field label="Schema database"><Input required maxLength={63} value={database.schema_name} onChange={event => updateDatabase("schema_name", event.target.value)} disabled={busy} /></Field>
            <Field label="Lokasi file sertifikat CA (opsional)"><Input value={database.ssl_root_cert} onChange={event => updateDatabase("ssl_root_cert", event.target.value)} disabled={busy} placeholder="C:\sertifikat\root.crt atau /path/root.crt" /></Field>
            <p className="text-sm text-muted">Kredensial database disimpan terenkripsi di desktop. Koneksi di luar localhost wajib memakai TLS dengan sertifikat server yang valid. Nama dan password akun aplikasi di bawah dipakai untuk memverifikasi akses workspace, bukan sebagai akun database.</p>
          </>}
          <Field label="Email akun aplikasi server">
            <Input type="email" autoComplete="username" required value={email}
              onChange={event => setEmail(event.target.value)} disabled={busy} />
          </Field>
          <Field label="Password akun aplikasi server">
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
            <div><dt className="text-muted">Jenis koneksi</dt><dd>{status.transport === "postgresql" ? "PostgreSQL langsung · backend web tidak diperlukan" : "API backend"}</dd></div>
            <div><dt className="text-muted">Server</dt><dd className="break-all">{status.server}</dd></div>
            <div><dt className="text-muted">Siklus terakhir selesai</dt>
              <dd>{status.last_success ? new Date(status.last_success).toLocaleString("id-ID") : "Belum pernah"}</dd>
            </div>
            <div><dt className="text-muted">Terakhir tanpa konflik atau penundaan</dt><dd>{status.last_complete ? new Date(status.last_complete).toLocaleString("id-ID") : "Belum pernah"}</dd></div>
            {status.device_expires_at && <div><dt className="text-muted">Sesi perangkat berlaku hingga</dt><dd>{new Date(status.device_expires_at).toLocaleString("id-ID")}</dd></div>}
          </dl>
          <fieldset disabled={disabled} className="flex flex-wrap items-center gap-4">
            <legend className="sr-only">Pengaturan sinkronisasi otomatis</legend>
            <Field label="Mode sinkronisasi">
              <Select value={status.auto_sync ? "automatic" : "manual"}
                onChange={event => void action(() => syncRequest("/settings", "PATCH", { auto_sync: event.target.value === "automatic", interval_seconds: status.interval_seconds }))}>
                <option value="manual">Manual saja</option>
                <option value="automatic">Manual + otomatis</option>
              </Select>
            </Field>
            <Field label="Periode sinkronisasi otomatis">
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
            ? (status.auto_sync ? "Sinkronisasi terakhir gagal. Data tetap disimpan lokal dan akan dicoba lagi otomatis." : "Sinkronisasi terakhir gagal. Data tetap disimpan lokal. Tekan Sinkronkan sekarang untuk mencoba lagi.")
            : !status.auto_sync && !status.running ? "Mode manual aktif. Sinkronisasi otomatis tidak berjalan." : status.message || "Menunggu sinkronisasi otomatis"}</p>
          {status.error && !status.running && <p role="alert" className={ui.error}>{status.error}</p>}
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
          {!!status.counts?.deferred && <p className="text-sm text-muted">{status.transport === "postgresql"
            ? "Perubahan dapat ditunda selama monitoring desktop atau proses backend web masih berjalan. Backend web yang aktif tetap melindungi data meskipun eventnya idle. Setelah proses terkait berhenti, sinkronisasi berikutnya mencoba perubahan tertunda."
            : "Hasil hitung baru tetap dapat disinkronkan saat monitoring. Perubahan konfigurasi, koreksi, dan penghapusan yang ditunda akan dicoba setelah monitoring berhenti."}</p>}
          <p className="text-sm text-muted">{status.transport === "postgresql"
            ? "Kredensial perangkat berlaku hingga tanggal di atas. Jika akses dicabut atau kedaluwarsa, putuskan koneksi lalu hubungkan PostgreSQL kembali. Data lokal dan baseline sinkronisasi tetap tersimpan."
            : "Sesi akses diperbarui otomatis selama kredensial perangkat masih berlaku. Jika akses dicabut atau masa perangkat habis, hubungkan ulang menggunakan form di bawah. Data lokal tetap tersimpan. Jika memutus koneksi saat offline, cabut juga akses perangkat lama melalui web."}</p>
          {status.conflicts.length > 0 && (
            <div className="space-y-3">
              <h3>Perubahan yang perlu dipilih ({status.conflicts_total ?? status.conflicts.length})</h3>
              {(status.conflicts_total || 0) > status.conflicts.length && <p className="text-sm text-muted">Menampilkan {status.conflicts.length} konflik pertama. Selesaikan lalu jalankan sinkronisasi untuk memuat sisanya.</p>}
              <p className="text-sm text-muted">Kedua sisi berubah sejak sinkronisasi terakhir. Pilih versi yang dipertahankan. Sinkronisasi berikutnya akan menerapkan pilihan tersebut.</p>
              <ul className="space-y-3">
                {status.conflicts.map(conflict => <li key={`${conflict.entity}:${conflict.key}`} className="border-b border-line pb-3">
                  <p className="text-sm">{labels[conflict.entity] || conflict.entity} · <span className="break-all">{conflict.key}</span></p>
                  <p className="text-xs text-muted">
                    Desktop: {conflict.local_hash ? "ada perubahan" : "dihapus"} · Server: {conflict.remote_hash ? "ada perubahan" : "dihapus"}
                    {conflict.choice && ` · Pilihan: ${conflict.choice === "local" ? "desktop" : "server"}`}
                  </p>
                  <div className="mt-2 space-y-2">
                    <Button disabled={disabled} onClick={() => void action(async () => {
                      const result = await syncRequest<ConflictDetail>(`/conflicts/${encodeURIComponent(conflict.entity)}/${encodeURIComponent(conflict.key)}`);
                      setDetails(previous => ({ ...previous, [`${conflict.entity}:${conflict.key}`]: { ...result, local_hash: conflict.local_hash, remote_hash: conflict.remote_hash } }));
                    })}>Lihat perbedaan</Button>
                    {details[`${conflict.entity}:${conflict.key}`] && details[`${conflict.entity}:${conflict.key}`].local_hash === conflict.local_hash && details[`${conflict.entity}:${conflict.key}`].remote_hash === conflict.remote_hash && (() => {
                      const detail = details[`${conflict.entity}:${conflict.key}`];
                      const display = (value: unknown) => value == null ? "—" : typeof value === "boolean" ? value ? "Ya" : "Tidak" : typeof value === "object" ? JSON.stringify(value) : String(value);
                      return <div><p className="font-medium">{detail.label}</p><p className="text-sm">Desktop: {detail.local_deleted ? "dihapus" : "tersedia"} · Server: {detail.server_deleted ? "dihapus" : "tersedia"}</p>
                        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Perbedaan versi desktop dan server</caption><thead><tr><th>Kolom</th><th>Desktop</th><th>Server</th></tr></thead><tbody>{detail.fields.map(row => <tr key={row.field} className="border-b border-line"><td className="p-2">{({ name: "Nama", full_name: "Nama lengkap", location: "Lokasi", event_date: "Tanggal mulai event", event_end_date: "Tanggal akhir event", event_start: "Jam mulai", event_end: "Jam selesai", capacity: "Kapasitas", status: "Status", gender: "Gender", direction: "Arah", detected_at: "Waktu deteksi", started_at: "Waktu mulai", completed_at: "Waktu selesai", line_position: "Posisi garis", line_orientation: "Orientasi garis", reverse_direction: "Balik arah", gender_enabled: "Deteksi gender", allow_duplicate: "Izinkan pengulangan", timezone: "Zona waktu", visitor_label: "Pengunjung", phone: "Telepon", line_angle: "Sudut garis", mirror: "Cermin", model_tier: "Model" } as Record<string, string>)[row.field] || row.field}</td><td className="max-w-xs break-words p-2">{display(row.local)}</td><td className="max-w-xs break-words p-2">{display(row.server)}</td></tr>)}</tbody></table></div>
                        {!!detail.protected_fields && <p className="text-xs text-muted">{detail.protected_fields} kolom lain berbeda; nilainya disembunyikan untuk melindungi data sensitif.</p>}
                      </div>;
                    })()}
                  </div>
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
          {!!status.history?.length && <div className="space-y-3"><h3>Riwayat sinkronisasi</h3>
            <p className="text-sm text-muted">Ringkasan 20 proses terakhir. Hitungan konflik dan penundaan menunjukkan hasil pemeriksaan saat proses tersebut, bukan jumlah perubahan baru setelahnya.</p>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Waktu mulai</th><th>Pemicu</th><th>Hasil</th><th>Dikirim / diterima</th><th>Konflik / ditunda</th></tr></thead><tbody>{status.history.map(run => <tr key={run.id} className="border-b border-line"><td className="py-2">{new Date(run.started_at).toLocaleString("id-ID")}</td><td>{run.trigger === "automatic" ? "Otomatis" : "Manual"}</td><td>{({ complete: "Selesai", attention: "Perlu tindakan", failed: "Gagal", interrupted: "Terputus", running: "Berjalan" } as Record<string, string>)[run.outcome] || run.outcome}{run.error_code ? ` (${run.error_code})` : ""}</td><td>{run.counts.uploaded || 0} / {run.counts.downloaded || 0}</td><td>{run.counts.conflicts || 0} / {run.counts.deferred || 0}</td></tr>)}</tbody></table></div>
          </div>}
          {status.auth_required && status.transport === "postgresql" && <p role="alert" className={ui.error}>Akses PostgreSQL perlu diperbarui. Pilih Putuskan koneksi, kemudian isi kembali koneksi database dan akun aplikasi.</p>}
          {status.auth_required && status.transport !== "postgresql" && <form onSubmit={connect} className="grid max-w-xl gap-3 border-t border-line pt-4"><h3>Hubungkan ulang sesi perangkat</h3>
            <Field label="URL API server"><Input type="url" required value={server || status.server} onChange={event => setServer(event.target.value)} disabled={busy} /></Field>
            <Field label="Email akun server"><Input type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></Field>
            <Field label="Password akun server"><Input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></Field>
            <Button type="submit" disabled={disabled}>Hubungkan ulang</Button>
          </form>}
        </div>
      )}
    </section>
  );
}
