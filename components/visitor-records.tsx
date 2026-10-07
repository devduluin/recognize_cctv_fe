"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { visitorFetch } from "./auth/visitor-api";
import { Button } from "./ui/button";
import { DataTable, TableContainer } from "./ui/data-table";
import { ui } from "./ui/styles";
import Modal from "./ui-modal";
import { toast } from "./ui/toast";
import { Field, Input, Select } from "./ui/field";
import VisitorCorrections from "./visitor-corrections";

const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor`;
const PAGE_SIZE = 25;

type VisitorRecord = {
  id: string;
  visitor_id: string;
  visitor_label: string;
  gender: string;
  direction: string;
  detected_at: string;
  has_photo: boolean;
};

function CapturePhoto({ record, eventId }: { record: VisitorRecord; eventId: string }) {
  const [photo, setPhoto] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!record.has_photo) return;
    const controller = new AbortController();
    let objectUrl = "";
    async function load() {
      try {
        const response = await visitorFetch(
          `${API_BASE}/events/${record.id}/photo?event_id=${encodeURIComponent(eventId)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Foto tidak tersedia.");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPhoto(objectUrl);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.id, record.has_photo, eventId]);

  if (!record.has_photo) return <span>Tanpa foto</span>;
  if (failed) return <span>Foto gagal dimuat</span>;
  if (!photo) return <span>Memuat foto…</span>;
  return <Image src={photo} unoptimized width={96} height={96} alt={`Capture ${record.visitor_label}`} className="h-24 w-24 rounded object-contain" />;
}

function MergeVisitors({ source, companyId, eventId, onClose, onMerged }: { source: VisitorRecord; companyId: string; eventId: string; onClose: () => void; onMerged: () => void }) {
  const [page, setPage] = useState(0);
  const [records, setRecords] = useState<{ page: number; rows: VisitorRecord[] } | null>(null);
  const [target, setTarget] = useState<VisitorRecord | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = records?.page === page ? records.rows : null;
  const candidates = rows?.filter((record, index) => record.visitor_id !== source.visitor_id && rows.findIndex((item) => item.visitor_id === record.visitor_id) === index);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ company_id: companyId, event_id: eventId, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    void (async () => {
      try {
        const response = await visitorFetch(`${API_BASE}/events?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Daftar pengunjung gagal dimuat.");
        const payload = await response.json();
        if (!controller.signal.aborted) setRecords({ page, rows: payload.result || [] });
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Daftar pengunjung gagal dimuat.");
      }
    })();
    return () => controller.abort();
  }, [companyId, eventId, page]);
  async function merge() {
    if (!target || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await visitorFetch(`${API_BASE}/visitors/merge?event_id=${encodeURIComponent(eventId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: source.visitor_id, target_id: target.visitor_id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.message || "Pengunjung gagal digabungkan.");
      onMerged();
      toast.success("Pengunjung berhasil digabungkan. Hitungan diperbarui.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Pengunjung gagal digabungkan.");
    } finally {
      setBusy(false);
    }
  }
  return <Modal title="Gabungkan pengunjung" size="small" busy={busy} onClose={onClose} description="Pilih identitas lain milik orang yang sama.">
    <div className="max-h-[65dvh] overflow-y-auto p-4 sm:p-6">
      <p>Semua capture <strong>{source.visitor_label}</strong> akan menggunakan identitas yang dipilih. Foto dan waktu lintasan tetap disimpan.</p>
      <div className="my-4"><CapturePhoto record={source} eventId={eventId} /></div>
      <fieldset disabled={busy} className="space-y-2">
        <legend className="mb-2 font-semibold">Gabungkan ke pengunjung</legend>
        {!rows ? <p role="status">Memuat pengunjung…</p> : !candidates?.length ? <p>Tidak ada identitas lain di halaman ini.</p> : candidates.map((record) => <label key={record.visitor_id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded border p-3">
          <input type="radio" name="merge-target" checked={target?.visitor_id === record.visitor_id} onChange={() => setTarget(record)} className="h-4 w-4 shrink-0" />
          <span>{record.visitor_label}<span className="block text-sm text-neutral-600">{new Date(record.detected_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</span></span>
        </label>)}
      </fieldset>
      <div className="my-4 flex flex-wrap items-center gap-2">
        <Button disabled={busy || page === 0} onClick={() => { setError(""); setPage((value) => value - 1); }}>Sebelumnya</Button>
        <span>Halaman {page + 1}</span>
        <Button disabled={busy || !rows || rows.length < PAGE_SIZE} onClick={() => { setError(""); setPage((value) => value + 1); }}>Berikutnya</Button>
      </div>
      {target && <div className="space-y-2 border-t pt-4"><p>Identitas setelah digabung: <strong>{target.visitor_label}</strong></p><CapturePhoto key={target.id} record={target} eventId={eventId} /><p className="text-sm text-neutral-600">Jika pengunjung duplikat dinonaktifkan, lintasan searah hanya dihitung sekali. Penggabungan tercatat di riwayat koreksi.</p></div>}
      {error && <p role="alert" className={`${ui.error} mt-4`}>{error}</p>}
    </div>
    <div className="flex flex-wrap justify-end gap-3 border-t p-4 sm:px-6">
      <Button disabled={busy} onClick={onClose}>Batal</Button>
      <Button variant="primary" disabled={busy || !target} onClick={() => void merge()}>{busy ? "Menggabungkan…" : "Gabungkan pengunjung"}</Button>
    </div>
  </Modal>;
}

type Filters = { search: string; direction: string; camera: string; from: string; to: string };
const DEFAULT_FILTERS: Filters = { search: "", direction: "", camera: "", from: "", to: "" };

export default function VisitorRecords({ companyId, eventId, version = "", monitoring = false, timezone = "Asia/Jakarta", cameras = [], onChanged }: { companyId: string; eventId: string; version?: string; monitoring?: boolean; timezone?: string; cameras?: { camera_id: string; name: string }[]; onChanged?: () => void }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [mergeSource, setMergeSource] = useState<VisitorRecord | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filterError, setFilterError] = useState("");
  const [result, setResult] = useState<{ key: string; rows: VisitorRecord[] } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const requestKey = `${companyId}:${eventId}:${page}:${refresh}:${version}:${JSON.stringify(filters)}`;
  const rows = result?.key === requestKey ? result.rows : null;
  const error = failure?.key === requestKey ? failure.message : "";

  useEffect(() => {
    if (!companyId || !eventId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const query = new URLSearchParams({ company_id: companyId, event_id: eventId, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
        if (filters.search.trim()) query.set("search", filters.search.trim());
        if (filters.direction) query.set("direction", filters.direction);
        if (filters.camera) query.set("camera_id", filters.camera);
        if (filters.from) query.set("from_time", new Date(filters.from).toISOString());
        if (filters.to) query.set("to_time", new Date(filters.to).toISOString());
        const response = await visitorFetch(`${API_BASE}/events?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Daftar capture gagal dimuat. Coba lagi.");
        const payload = await response.json();
        if (!controller.signal.aborted) setResult({ key: requestKey, rows: payload.result || [] });
      } catch (error) {
        if (!controller.signal.aborted) setFailure({ key: requestKey, message: error instanceof Error ? error.message : "Daftar capture gagal dimuat." });
      }
    }
    void load();
    return () => controller.abort();
  }, [companyId, eventId, page, requestKey, filters]);

  if (!eventId) return <p>Pilih event untuk melihat capture pengunjung.</p>;
  return (
    <section aria-label="Capture pengunjung">
      <div className={ui.sectionHeading}>
        <div>
          <h2>Capture Pengunjung</h2>
          <p className={ui.pageDescription}>Record masuk dan keluar saat pengunjung melewati garis.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button aria-expanded={showHistory} onClick={() => setShowHistory((value) => !value)}>Riwayat koreksi</Button><Button onClick={() => setRefresh((value) => value + 1)}>Muat ulang</Button></div>
      </div>
      <form className="mb-4 space-y-3" onSubmit={(event) => {
        event.preventDefault();
        if (draftFilters.from && draftFilters.to && new Date(draftFilters.from) > new Date(draftFilters.to)) { setFilterError("Waktu mulai harus sebelum waktu akhir."); return; }
        setFilterError(""); setFilters({ ...draftFilters }); setPage(0);
      }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field>Nama atau ID pengunjung<Input maxLength={100} placeholder="Contoh: Visitor 2" value={draftFilters.search} onChange={(event) => setDraftFilters((value) => ({ ...value, search: event.target.value }))} /></Field>
          <Field>Arah<Select value={draftFilters.direction} onChange={(event) => setDraftFilters((value) => ({ ...value, direction: event.target.value }))}><option value="">Semua arah</option><option value="in">Masuk</option><option value="out">Keluar</option></Select></Field>
          {cameras.length > 0 && <Field>Kamera<Select value={draftFilters.camera} onChange={(event) => setDraftFilters((value) => ({ ...value, camera: event.target.value }))}><option value="">Semua kamera</option>{cameras.map((camera) => <option key={camera.camera_id} value={camera.camera_id}>{camera.name}</option>)}</Select></Field>}
          <Field>Waktu mulai<Input type="datetime-local" value={draftFilters.from} onChange={(event) => setDraftFilters((value) => ({ ...value, from: event.target.value }))} /></Field>
          <Field>Waktu akhir<Input type="datetime-local" value={draftFilters.to} onChange={(event) => setDraftFilters((value) => ({ ...value, to: event.target.value }))} /></Field>
        </div>
        <p className="text-sm text-neutral-600">Filter waktu mengikuti zona waktu perangkat Anda. Waktu capture ditampilkan dalam {timezone}.</p>
        {filterError && <p role="alert" className={ui.error}>{filterError}</p>}
        <div className="flex flex-wrap gap-2"><Button type="submit" variant="primary">Terapkan filter</Button><Button type="button" onClick={() => { setDraftFilters(DEFAULT_FILTERS); setFilters(DEFAULT_FILTERS); setFilterError(""); setPage(0); }}>Hapus filter</Button></div>
      </form>
      {monitoring && <p className="mb-4 text-sm text-neutral-600">Hentikan monitoring untuk menggabungkan pengunjung yang tercatat sebagai dua identitas.</p>}
      {error ? <p role="alert" className={ui.error}>{error}</p> : !rows ? <p role="status" className={ui.emptyState}>Memuat capture…</p> : rows.length === 0 ? <p className={ui.emptyState}>Tidak ada capture yang sesuai pada halaman ini. Coba ubah filter atau kembali ke halaman sebelumnya.</p> : (
        <TableContainer>
          <DataTable>
            <thead><tr><th scope="col">Foto</th><th scope="col">Pengunjung</th><th scope="col">Arah</th><th scope="col">Gender</th><th scope="col">Waktu</th><th scope="col">Tindakan</th></tr></thead>
            <tbody>{rows.map((record) => (
              <tr key={record.id}>
                <td><CapturePhoto key={`${eventId}:${record.id}`} record={record} eventId={eventId} /></td>
                <td>{record.visitor_label}</td>
                <td>{record.direction === "in" ? "Masuk" : "Keluar"}</td>
                <td>{record.gender === "male" ? "Laki-laki" : record.gender === "female" ? "Perempuan" : "Belum diketahui"}</td>
                <td>{new Date(record.detected_at).toLocaleString("id-ID", { timeZone: timezone })}</td>
                <td><Button disabled={monitoring} aria-label={`Gabungkan ${record.visitor_label}`} onClick={() => setMergeSource(record)}>Gabungkan</Button></td>
              </tr>
            ))}</tbody>
          </DataTable>
        </TableContainer>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button>
        <span>Halaman {page + 1}</span>
        <Button disabled={!rows || rows.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button>
      </div>
      {mergeSource && <MergeVisitors source={mergeSource} companyId={companyId} eventId={eventId} onClose={() => setMergeSource(null)} onMerged={() => { setMergeSource(null); setPage(0); setRefresh((value) => value + 1); onChanged?.(); }} />}
      {showHistory && <VisitorCorrections key={refresh} eventId={eventId} monitoring={monitoring} timezone={timezone} onChanged={() => { setRefresh((value) => value + 1); onChanged?.(); }} />}
    </section>
  );
}
