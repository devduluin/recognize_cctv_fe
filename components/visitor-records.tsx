"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { visitorFetch } from "./auth/visitor-api";
import { Button } from "./ui/button";
import { DataTable, TableContainer } from "./ui/data-table";
import { ui } from "./ui/styles";

const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor`;
const PAGE_SIZE = 25;

type VisitorRecord = {
  id: string;
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

export default function VisitorRecords({ companyId, eventId, version = "" }: { companyId: string; eventId: string; version?: string }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: VisitorRecord[] } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const requestKey = `${companyId}:${eventId}:${page}:${refresh}:${version}`;
  const rows = result?.key === requestKey ? result.rows : null;
  const error = failure?.key === requestKey ? failure.message : "";

  useEffect(() => {
    if (!companyId || !eventId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const query = new URLSearchParams({ company_id: companyId, event_id: eventId, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
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
  }, [companyId, eventId, page, requestKey]);

  if (!eventId) return <p>Pilih event untuk melihat capture pengunjung.</p>;
  return (
    <section aria-label="Capture pengunjung">
      <div className={ui.sectionHeading}>
        <div>
          <h2>Capture Pengunjung</h2>
          <p className={ui.pageDescription}>Record masuk dan keluar saat pengunjung melewati garis.</p>
        </div>
        <Button onClick={() => setRefresh((value) => value + 1)}>Muat ulang</Button>
      </div>
      {error ? <p role="alert" className={ui.error}>{error}</p> : !rows ? <p role="status" className={ui.emptyState}>Memuat capture…</p> : rows.length === 0 ? <p className={ui.emptyState}>Belum ada record lintasan pada halaman ini.</p> : (
        <TableContainer>
          <DataTable>
            <thead><tr><th scope="col">Foto</th><th scope="col">Pengunjung</th><th scope="col">Arah</th><th scope="col">Gender</th><th scope="col">Waktu</th></tr></thead>
            <tbody>{rows.map((record) => (
              <tr key={record.id}>
                <td><CapturePhoto key={`${eventId}:${record.id}`} record={record} eventId={eventId} /></td>
                <td>{record.visitor_label}</td>
                <td>{record.direction === "in" ? "Masuk" : "Keluar"}</td>
                <td>{record.gender === "male" ? "Laki-laki" : record.gender === "female" ? "Perempuan" : "Belum diketahui"}</td>
                <td>{new Date(record.detected_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</td>
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
    </section>
  );
}
