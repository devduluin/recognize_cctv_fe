"use client";

import { useEffect, useState } from "react";
import { visitorFetch } from "./auth/visitor-api";
import Modal from "./ui-modal";
import { Button } from "./ui/button";
import { DataTable, TableContainer } from "./ui/data-table";
import { ui } from "./ui/styles";
import { toast } from "./ui/toast";

const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor`;
type Correction = {
  id: string;
  source_label: string;
  target_label: string;
  actor_name?: string;
  created_at: string;
  undone_at: string | null;
  undone_name?: string;
  can_undo: boolean;
};

export default function VisitorCorrections({ eventId, monitoring, timezone, onChanged }: { eventId: string; monitoring: boolean; timezone: string; onChanged: () => void }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: Correction[] } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [selected, setSelected] = useState<Correction | null>(null);
  const [busy, setBusy] = useState(false);
  const [undoError, setUndoError] = useState("");
  const key = `${eventId}:${page}:${refresh}`;
  const rows = result?.key === key ? result.rows : null;
  const error = failure?.key === key ? failure.message : "";
  const format = (value: string) => new Date(value).toLocaleString("id-ID", { timeZone: timezone });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const query = new URLSearchParams({ event_id: eventId, limit: "25", offset: String(page * 25) });
        const response = await visitorFetch(`${API_BASE}/corrections?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Riwayat koreksi gagal dimuat. Coba muat ulang.");
        const payload = await response.json();
        if (!controller.signal.aborted) setResult({ key, rows: payload.result || [] });
      } catch (error) {
        if (!controller.signal.aborted) setFailure({ key, message: error instanceof Error ? error.message : "Riwayat koreksi gagal dimuat." });
      }
    })();
    return () => controller.abort();
  }, [eventId, page, key]);
  async function undo() {
    if (!selected || busy || monitoring) return;
    setBusy(true);
    setUndoError("");
    try {
      const response = await visitorFetch(`${API_BASE}/corrections/${selected.id}/undo?event_id=${encodeURIComponent(eventId)}`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.message || "Penggabungan gagal dibatalkan.");
      setSelected(null);
      setRefresh((value) => value + 1);
      onChanged();
      toast.success("Penggabungan dibatalkan. Identitas dan hitungan diperbarui.");
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : "Penggabungan gagal dibatalkan.");
    } finally {
      setBusy(false);
    }
  }
  return <section aria-label="Riwayat koreksi" className="mt-6 border-t pt-6">
    <div className={ui.sectionHeading}>
      <div><h3>Riwayat koreksi</h3><p className={ui.pageDescription}>Penggabungan pengunjung dan pembatalannya. Batalkan penggabungan terbaru terlebih dahulu.</p></div>
      <Button onClick={() => setRefresh((value) => value + 1)}>Muat ulang riwayat</Button>
    </div>
    {monitoring && <p className="mb-4 text-sm text-neutral-600">Hentikan monitoring sebelum membatalkan penggabungan.</p>}
    {error ? <p role="alert" className={ui.error}>{error}</p> : !rows ? <p role="status">Memuat riwayat koreksi…</p> : !rows.length ? <p>Belum ada koreksi pengunjung.</p> : <TableContainer><DataTable>
      <thead><tr><th scope="col">Perubahan</th><th scope="col">Oleh</th><th scope="col">Waktu</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>
        <td>{row.source_label} digabung ke {row.target_label}</td><td>{row.actor_name || "Pengguna"}</td><td>{format(row.created_at)}</td>
        <td>{row.undone_at ? <span>Dibatalkan oleh {row.undone_name || "pengguna"}<span className="block text-sm text-neutral-600">{format(row.undone_at)}</span></span> : "Digabung"}</td>
        <td>{row.can_undo ? <Button disabled={monitoring} onClick={() => { setUndoError(""); setSelected(row); }}>Batalkan penggabungan</Button> : row.undone_at ? "—" : "Ada penggabungan yang lebih baru"}</td>
      </tr>)}</tbody>
    </DataTable></TableContainer>}
    <div className="mt-4 flex flex-wrap items-center gap-3"><Button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Riwayat sebelumnya</Button><span>Halaman {page + 1}</span><Button disabled={!rows || rows.length < 25} onClick={() => setPage((value) => value + 1)}>Riwayat berikutnya</Button></div>
    {selected && <Modal title="Batalkan penggabungan?" size="small" busy={busy} onClose={() => setSelected(null)}>
      <div className="space-y-4 p-4 sm:p-6"><p><strong>{selected.source_label}</strong> dan <strong>{selected.target_label}</strong> akan kembali menjadi dua identitas. Foto tetap tersimpan dan hitungan diperbarui.</p><p className="text-sm text-neutral-600">Pembatalan tersedia selama belum ada lintasan baru untuk pengunjung ini setelah digabung.</p>{undoError && <p role="alert" className={ui.error}>{undoError}</p>}</div>
      <div className="flex flex-wrap justify-end gap-3 border-t p-4"><Button disabled={busy} onClick={() => setSelected(null)}>Tetap digabung</Button><Button variant="primary" disabled={busy || monitoring} onClick={() => void undo()}>{busy ? "Membatalkan…" : "Ya, batalkan penggabungan"}</Button></div>
    </Modal>}
  </section>;
}
