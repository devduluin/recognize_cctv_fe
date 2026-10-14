"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Upload, Video } from "lucide-react";
import { visitorFetch } from "../../components/auth/visitor-api";
import { Button } from "../../components/ui/button";
import { Field, Input, Select, Switch } from "../../components/ui/field";
import { Page, PageHeading, Panel } from "../../components/ui/layout";
import { ui } from "../../components/ui/styles";
import CountingLineOverlay from "../../components/camera/counting-line-overlay";
import { validateVideo, videoTime, videoUploadUrl, type VideoOptions } from "../../components/video-analysis-api";

const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor`;
const STORAGE_KEY = "visitor_video_analysis";
const labels: Record<string, string> = { uploading: "Mengupload video…", queued: "Menunggu giliran deteksi…", processing: "Memproses video…", completed: "Deteksi selesai", failed: "Deteksi gagal", cancelled: "Deteksi dihentikan" };
type Analysis = {
  id: string;
  filename: string;
  status: string;
  error?: string;
  progress_percent?: number;
  video_seconds?: number;
  duration_seconds?: number;
  decoded_frames?: number;
  total_frames?: number;
  has_preview?: boolean;
  stats?: { in_count: number; out_count: number; unique_visitor_count: number; male_count: number; female_count: number; unknown_gender_count: number };
  unresolved_crossings?: { in: number; out: number };
  records?: { id: string; visitor_label: string; direction: string; gender: string; video_seconds: number }[];
};

async function readResult(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : payload.message || "Permintaan gagal. Coba lagi.");
  return payload.result;
}

export default function VideoDetectionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const [options, setOptions] = useState<VideoOptions>({ line_position: 0.5, line_orientation: "horizontal", reverse_direction: false, gender_enabled: false });
  const [maxBytes, setMaxBytes] = useState(500 * 1024 * 1024);
  const [limitsReady, setLimitsReady] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Analysis | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const uploadController = useRef<AbortController | null>(null);
  const previewObjectUrl = useRef("");
  const active = uploading || (!!jobId && (!job || ["uploading", "queued", "processing"].includes(job.status)));

  useEffect(() => {
    const controller = new AbortController();
    visitorFetch(`${API_BASE}/video-analyses/limits`, { signal: controller.signal })
      .then(readResult).then((result) => {
        if (controller.signal.aborted) return;
        setMaxBytes(result.max_bytes);
        setLimitsReady(true);
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setJobId(saved);
      }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => { controller.abort(); uploadController.current?.abort(); };
  }, []);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current); }, []);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await visitorFetch(`${API_BASE}/video-analyses/${encodeURIComponent(jobId!)}`, { signal: controller.signal, cache: "no-store" });
        if (response.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          if (!controller.signal.aborted) { setJobId(null); setJob(null); }
          throw new Error("Hasil video sudah tidak tersedia. Pilih video untuk memulai kembali.");
        }
        const result: Analysis = await readResult(response);
        if (controller.signal.aborted) return;
        setJob(result);
        setError("");
        if (result.has_preview) {
          const imageResponse = await visitorFetch(`${API_BASE}/video-analyses/${encodeURIComponent(jobId!)}/preview`, { signal: controller.signal, cache: "no-store" });
          if (imageResponse.ok) {
            const blob = await imageResponse.blob();
            if (controller.signal.aborted) return;
            const url = URL.createObjectURL(blob);
            const previous = previewObjectUrl.current;
            previewObjectUrl.current = url;
            setPreviewUrl(url);
            if (previous) URL.revokeObjectURL(previous);
          }
        }
        if (!["completed", "failed", "cancelled"].includes(result.status)) timer = setTimeout(poll, 1500);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Status video gagal dimuat.");
          timer = setTimeout(poll, 3000);
        }
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [jobId]);

  function chooseFile(selected: File | null) {
    if (!selected) return;
    const message = validateVideo(selected, maxBytes);
    if (message) { setError(message); return; }
    setError("");
    setFile(selected);
    setSourceUrl(URL.createObjectURL(selected));
    setDimensions({ width: 1280, height: 720 });
  }

  async function upload() {
    if (!file || active || !limitsReady) return;
    const message = validateVideo(file, maxBytes);
    if (message) { setError(message); return; }
    setError("");
    setUploading(true);
    const controller = new AbortController();
    uploadController.current = controller;
    try {
      const result = await readResult(await visitorFetch(videoUploadUrl(API_BASE, file, options), {
        method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file, signal: controller.signal,
      }));
      if (controller.signal.aborted) return;
      setJob(null);
      setPreviewUrl("");
      setJobId(result.id);
      localStorage.setItem(STORAGE_KEY, result.id);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Video gagal diupload.");
    } finally {
      if (!controller.signal.aborted) setUploading(false);
    }
  }

  async function cancel() {
    if (!jobId) return;
    setCancelling(true);
    try {
      const result = await readResult(await visitorFetch(`${API_BASE}/video-analyses/${encodeURIComponent(jobId)}/cancel`, { method: "POST" }));
      setJob(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Proses gagal dihentikan."); }
    finally { setCancelling(false); }
  }

  function download() {
    if (!job || job.status !== "completed") return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(job, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hasil-video-${job.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <Page>
    <PageHeading><div><p className={ui.eyebrow}>VISITOR COUNTER</p><h1>Deteksi Video</h1><p className={ui.pageDescription}>Upload rekaman, atur garis hitung, lalu lihat hasil deteksi pengunjung.</p></div></PageHeading>
    {error && <p role="alert" className={ui.error}>{error}</p>}
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Panel><h2 className="mb-2 text-lg font-semibold">Upload video</h2><p className="mb-5 text-sm text-muted">MP4, MOV, MKV, AVI, atau WebM. Maksimal {Math.floor(maxBytes / 1024 / 1024)} MB dan 30 menit.</p>
        <div className="space-y-4">
          <Field>File video<Input type="file" accept=".mp4,.mov,.mkv,.avi,.webm" disabled={active || !limitsReady} onChange={(event) => chooseFile(event.target.files?.[0] || null)} /></Field>
          {sourceUrl ? <div className="relative overflow-hidden rounded-lg bg-black" style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
            <video src={sourceUrl} controls preload="metadata" className="h-full w-full" onLoadedMetadata={(event) => setDimensions({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight })} />
            <CountingLineOverlay config={{ linePosition: options.line_position, lineOrientation: options.line_orientation, reverseDirection: options.reverse_direction, twoLineCounting: true, zoneWidthRatio: 0.20 }} mediaWidth={dimensions.width} mediaHeight={dimensions.height} showLabels={false} />
          </div> : <div className="grid aspect-video place-content-center gap-2 rounded-lg bg-slate-50 text-center text-muted"><Video size={32} className="mx-auto" /><p className="text-sm">Pilih video untuk melihat pratinjau.</p></div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>Orientasi garis<Select disabled={active} value={options.line_orientation} onChange={(event) => setOptions({ ...options, line_orientation: event.target.value as VideoOptions["line_orientation"] })}><option value="horizontal">Horizontal</option><option value="vertical">Vertikal</option></Select></Field>
            <Field>Posisi garis: {Math.round(options.line_position * 100)}%<Input type="range" min="10" max="90" step="1" disabled={active} value={Math.round(options.line_position * 100)} onChange={(event) => setOptions({ ...options, line_position: Number(event.target.value) / 100 })} /></Field>
          </div>
          <p className="text-sm text-muted">Arah masuk: {options.line_orientation === "horizontal" ? (options.reverse_direction ? "bawah ke atas" : "atas ke bawah") : (options.reverse_direction ? "kanan ke kiri" : "kiri ke kanan")}. Orang dihitung setelah melewati kedua batas garis.</p>
          <Field className="flex! items-center justify-between gap-3">Balik arah masuk<Switch checked={options.reverse_direction} disabled={active} onChange={(event) => setOptions({ ...options, reverse_direction: event.target.checked })} /></Field>
          <Field className="flex! items-center justify-between gap-3">Deteksi gender<Switch checked={options.gender_enabled} disabled={active} onChange={(event) => setOptions({ ...options, gender_enabled: event.target.checked })} /></Field>
          <div className="flex flex-wrap gap-2"><Button variant="primary" disabled={!file || active || !limitsReady} onClick={() => void upload()}>{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}{uploading ? "Mengupload…" : "Upload dan deteksi"}</Button>{uploading && <Button onClick={() => { uploadController.current?.abort(); setUploading(false); }}>Batalkan upload</Button>}</div>
          <p className="text-xs leading-relaxed text-muted">Hasil video tersimpan terpisah dari laporan event. File sumber dihapus setelah proses berakhir; hasil disimpan hingga 24 jam atau tiga analisis terbaru.</p>
        </div>
      </Panel>
      <Panel aria-busy={active}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Hasil deteksi</h2>{job?.status === "completed" && <Button onClick={download}><Download size={16} />Unduh hasil</Button>}</div>
        {job ? <div className="space-y-4">
          <p className="break-all text-sm font-medium">{job.filename}</p><p role="status" className="text-sm">{labels[job.status] || job.status}</p>
          {job.error && <p role="alert" className={ui.error}>{job.error}</p>}
          <progress aria-label="Progres deteksi video" max={100} value={job.progress_percent || 0} className="h-3 w-full accent-navy" />
          <p className="text-xs text-muted">{job.progress_percent || 0}% · {videoTime(job.video_seconds || 0)} / {videoTime(job.duration_seconds || 0)}</p>
          {previewUrl && <div className="overflow-hidden rounded-lg bg-black">
            {/* Authenticated JPEG is already resized by the detector. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Frame video dengan garis hitung dan hasil deteksi pengunjung" className="w-full" />
          </div>}
          {job.stats && <dl className="grid grid-cols-3 gap-3">{[["Masuk", job.stats.in_count], ["Keluar", job.stats.out_count], ["Pengunjung unik", job.stats.unique_visitor_count]].map(([label, value]) => <div key={label} className="rounded-lg border border-line p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>)}</dl>}
          {job.stats && <p className="text-sm text-muted">Pria: {job.stats.male_count} · Wanita: {job.stats.female_count} · Gender belum diketahui: {job.stats.unknown_gender_count}</p>}
          {!!job.unresolved_crossings && (job.unresolved_crossings.in > 0 || job.unresolved_crossings.out > 0) && <p className="text-sm text-amber-800">Lintasan yang identitasnya belum terkonfirmasi: {job.unresolved_crossings.in} masuk, {job.unresolved_crossings.out} keluar.</p>}
          {active && !uploading && <Button variant="stop" disabled={cancelling} onClick={() => void cancel()}>{cancelling ? "Menghentikan…" : "Hentikan deteksi"}</Button>}
          {job.records && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-2 text-left text-muted">Lintasan tercatat · maksimal 500 baris terakhir</caption><thead><tr className="border-b border-line"><th className="py-2">Waktu video</th><th>Pengunjung</th><th>Arah</th><th>Gender</th></tr></thead><tbody>{job.records.map((row) => <tr key={row.id} className="border-b border-line"><td className="py-2">{videoTime(row.video_seconds)}</td><td>{row.visitor_label}</td><td>{row.direction === "in" ? "Masuk" : "Keluar"}</td><td>{row.gender === "male" ? "Pria" : row.gender === "female" ? "Wanita" : "Belum diketahui"}</td></tr>)}</tbody></table>{!job.records.length && <p className="mt-3 text-sm text-muted">Belum ada lintasan yang terkonfirmasi. Periksa posisi garis dan arah pergerakan dalam video.</p>}</div>}
        </div> : <p className="py-12 text-center text-sm text-muted">{uploading ? "Video sedang diupload. Deteksi dimulai setelah upload selesai." : "Hasil akan tampil setelah video diproses."}</p>}
      </Panel>
    </div>
  </Page>;
}
