"use client";
import { visitorFetch } from "../../components/auth/visitor-api";
import { Button } from "../../components/ui/button";
import { toast } from "../../components/ui/toast";
import { Field, Input } from "../../components/ui/field";
import { Page, PageHeading, Toolbar } from "../../components/ui/layout";
import { DataTable, StatusBadge, TableContainer, RowMenu } from "../../components/ui/data-table";
import { cx, ui } from "../../components/ui/styles";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FormEvent,
} from "react";
import { Plus, Search, ChevronsUpDown, ChevronDown, ChevronUp, FlaskConical } from "lucide-react";
import CameraTestPreview from "../../components/camera-test-preview";
import Modal from "../../components/ui-modal";
type CCTVCamera = {
  id: string;
  name: string;
  rtsp_url?: string;
  camera_source?: string;
  status?: string;
  last_used?: string;
  events?: string[];
};
const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/cctv`;
export default function KameraPage() {
  const [cameras, setCameras] = useState<CCTVCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [showDummyTesting, setShowDummyTesting] = useState(false);
  const [sort, setSort] = useState<{
    key: "name" | "events" | "last_used" | "status";
    direction: number;
  }>({ key: "name", direction: 1 });
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = JSON.parse(localStorage.getItem("user_info") || "null");
      const cid =
        (user?.account_type === "personal" ? user?.id : user?.company_id) ||
        localStorage.getItem("cctv_company_id") ||
        "";
      setCompanyId(cid);
      if (!cid) throw new Error("Workspace belum tersedia.");
      const response = await visitorFetch(
        `${API_BASE}/cameras/${encodeURIComponent(cid)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Daftar kamera belum dapat dimuat.");
      const payload = await response.json();
      setCameras(Array.isArray(payload.result) ? payload.result : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kamera gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(load, 0);
    return () => clearTimeout(initial);
  }, [load]);
  const visible = useMemo(
    () =>
      cameras
        .filter((camera) =>
          camera.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort(
          (a, b) =>
            sort.direction *
            String(a[sort.key] || "").localeCompare(String(b[sort.key] || "")),
        ),
    [cameras, query, sort],
  );
  function open(camera?: CCTVCamera) {
    setName(camera?.name || "");
    setSource(camera?.rtsp_url || camera?.camera_source || "");
    setEditingId(camera?.id || null);
    setFormError("");
    setShowDummyTesting(false);
    setIsOpen(true);
  }
  function selectDummyVideo(sampleName: string, filename: string) {
    if (!name) setName(sampleName);
    const base = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "").replace(/\/+$/, "");
    setSource(base ? `${base}/samples/${filename}` : `./samples/${filename}`);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const response = await visitorFetch(
        `${API_BASE}/source/${encodeURIComponent(companyId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            camera_source: source.trim(),
            ...(editingId ? { camera_id: editingId } : {}),
          }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          typeof payload?.detail === "string"
            ? payload.detail
            : "Kamera belum dapat disimpan.",
        );
      }
      setIsOpen(false);
      toast.success(editingId ? "Perubahan kamera disimpan." : "Kamera berhasil ditambahkan.");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kamera gagal disimpan.";
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Hapus kamera ini?")) return;
    try {
      const response = await visitorFetch(
        `${API_BASE}/cameras/${encodeURIComponent(companyId)}/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Kamera belum dapat dihapus.");
      toast.success("Kamera berhasil dihapus.");
      setSelected((previous) => previous.filter((value) => value !== id));
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kamera gagal dihapus.";
      setError(message);
      toast.error(message);
    }
  }
  return (
    <Page>
      <PageHeading>
        <div>
          <p className={ui.eyebrow}>SISTEM</p>
          <h1>Kamera</h1>
          <p className={ui.pageDescription}>
            Daftar kamera yang dapat digunakan untuk pemantauan
          </p>
        </div>
        <Toolbar>
          <Field>
            Cari Kamera
            <span className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kamera..."
                className="pl-9"
              />
            </span>
          </Field>
          <Button
            variant="outline"
            disabled={!selected.length}
            onClick={() => setPreview(true)}
          >
            Test Kamera
          </Button>
          <Button variant="primary" onClick={() => open()}>
            <Plus size={16} />
            Tambahkan Kamera
          </Button>
        </Toolbar>
      </PageHeading>
      {error && (
        <p role="alert" className={ui.error}>
          {error}{" "}
          <button className="underline" onClick={load}>
            Coba lagi
          </button>
        </p>
      )}
      <TableContainer>
        {loading ? (
          <p role="status" className={ui.emptyState}>
            Memuat data…
          </p>
        ) : !visible.length ? (
          <div className={ui.emptyState}>
            <strong>
              {cameras.length ? "Kamera tidak ditemukan" : "Belum ada kamera"}
            </strong>
            <p className="mt-2">
              {cameras.length
                ? "Coba kata kunci lain."
                : "Klik Tambahkan Kamera untuk menambahkan sumber kamera."}
            </p>
          </div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    aria-label="Pilih semua kamera"
                    type="checkbox"
                    checked={
                      visible.length > 0 &&
                      visible.every((camera) => selected.includes(camera.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [
                              ...new Set([
                                ...selected,
                                ...visible.map((camera) => camera.id),
                              ]),
                            ]
                          : selected.filter(
                              (id) =>
                                !visible.some((camera) => camera.id === id),
                            ),
                      )
                    }
                  />
                </th>
                {(
                  [
                    { key: "name", label: "Nama Kamera" },
                    { key: "events", label: "Event Terkait" },
                    { key: "last_used", label: "Terakhir Digunakan" },
                    { key: "status", label: "Status" },
                  ] as const
                ).map(({ key, label }) => (
                  <th
                    key={key}
                    aria-sort={
                      sort.key === key
                        ? sort.direction === 1
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      onClick={() =>
                        setSort({
                          key,
                          direction: sort.key === key ? -sort.direction : 1,
                        })
                      }
                    >
                      {label}
                      <ChevronsUpDown size={14} className="text-neutral-400" />
                    </button>
                  </th>
                ))}
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((camera) => (
                <tr
                  key={camera.id}
                  data-running={camera.status?.toLowerCase() === "running"}
                >
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${camera.name}`}
                      checked={selected.includes(camera.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, camera.id]
                            : selected.filter((id) => id !== camera.id),
                        )
                      }
                    />
                  </td>
                  <td>{camera.name}</td>
                  <td>
                    {camera.events?.length ? (
                      <ul className="list-disc pl-4 leading-5">
                        {camera.events.map((event, i) => (
                          <li key={i}>{event}</li>
                        ))}
                      </ul>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-pre-line">
                    {camera.last_used || "-"}
                  </td>
                  <td>
                    <StatusBadge
                      data-running={camera.status?.toLowerCase() === "running"}
                    >
                      {camera.status || "OFF"}
                    </StatusBadge>
                  </td>
                  <td>
                    <RowMenu triggerAriaLabel={`Aksi ${camera.name}`}>
                      <button onClick={() => open(camera)}>
                        Edit Kamera
                      </button>
                      <button
                        onClick={() => {
                          setSelected([camera.id]);
                          setPreview(true);
                        }}
                      >
                        Test Kamera
                      </button>
                      <button
                        className="text-red-700"
                        onClick={() => remove(camera.id)}
                      >
                        Hapus
                      </button>
                    </RowMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </TableContainer>
      {isOpen && (
        <Modal
          title={editingId ? "Edit Kamera" : "Tambahkan Kamera"}
          onClose={() => setIsOpen(false)}
          busy={busy}
          size="small"
        >
          <form onSubmit={save}>
            <fieldset disabled={busy} className={cx(ui.modalBody, "space-y-4")}>
              {formError && (
                <p role="alert" className={ui.error}>
                  {formError}
                </p>
              )}
              <Field>
                Nama Kamera
                <Input
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                Sumber Kamera
                <Input
                  required
                  placeholder="0, rtsp://host/stream, atau URL/path video"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowDummyTesting((previous) => !previous)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors py-0.5"
                  >
                    <FlaskConical size={13} className="text-amber-500" />
                    <span>Dummy Testing</span>
                    {showDummyTesting ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {showDummyTesting && (
                    <div className="mt-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/80 space-y-2 text-xs">
                      <div className="text-[11px] font-medium text-slate-500">
                        Pilih sample video link untuk pengujian:
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!name) setName("Sample Lobby");
                            const base = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "").replace(/\/+$/, "");
                            setSource(base ? `${base}/samples/gettyimages-926491036-640_adpp.mp4` : `./samples/gettyimages-926491036-640_adpp.mp4`);
                          }}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          Lobby Entrance
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!name) setName("Sample Lorong");
                            const base = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "").replace(/\/+$/, "");
                            setSource(base ? `${base}/samples/sample_faces.mp4` : `./samples/sample_faces.mp4`);
                          }}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          Lorong Kantor
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!name) setName("Sample Turnstile");
                            const base = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "").replace(/\/+$/, "");
                            setSource(base ? `${base}/samples/sample_people.mp4` : `./samples/sample_people.mp4`);
                          }}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          Turnstile
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!name) setName("Sample Gerbang");
                            const base = (process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "").replace(/\/+$/, "");
                            setSource(base ? `${base}/samples/gettyimages-2154415328-640_adpp.mp4` : `./samples/gettyimages-2154415328-640_adpp.mp4`);
                          }}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          Gerbang Event
                        </button>
                        <button
                          type="button"
                          onClick={() => selectDummyVideo("Tes Sample", "tes-sample.mp4")}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          Tes Sample
                        </button>
                        <button
                          type="button"
                          onClick={() => selectDummyVideo("Sample CAVIAR Crossing", "cctv-footage-crossingpaths1cor.mp4")}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          CAVIAR Crossing
                        </button>
                        <button
                          type="button"
                          onClick={() => selectDummyVideo("Sample CAVIAR Tiga Orang", "cctv-footage-threepastshop1cor.mp4")}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          CAVIAR 3 Orang
                        </button>
                        <button
                          type="button"
                          onClick={() => selectDummyVideo("Sample CAVIAR Keluar Toko", "cctv-footage-oneleaveshop2cor.mp4")}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          CAVIAR Keluar Toko
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!name) setName("Sample (Path Lokal)");
                            setSource("./samples/sample_faces.mp4");
                          }}
                          className="px-2.5 py-1 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium shadow-sm transition"
                        >
                          Path Docker (./samples)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!name) setName("Webcam");
                            setSource("0");
                          }}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium shadow-sm transition"
                        >
                          Webcam (0)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Field>
            </fieldset>
            <footer className={ui.modalFooter}>
              <Button
                type="button"
                disabled={busy}
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={busy || !companyId || !name.trim() || !source.trim()}
                type="submit"
              >
                {busy ? "Menyimpan…" : "Simpan Kamera"}
              </Button>
            </footer>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title="Test Kamera" onClose={() => setPreview(false)}>
          <div
            className={cx(ui.modalBody, "grid gap-3", selected.length > 1 && "sm:grid-cols-2")}
          >
            {cameras
              .filter((camera) => selected.includes(camera.id))
              .map((camera) => (
                <div key={camera.id} className="relative">
                  <CameraTestPreview
                    source={camera.rtsp_url || camera.camera_source || ""}
                    position={50}
                    orientation="horizontal"
                    reversed={false}
                    autoStart
                    hideLineUI
                  />
                  <p className="mt-2 text-right text-xs text-slate-600">
                    {camera.name}
                  </p>
                </div>
              ))}
          </div>
          <footer className={ui.modalFooter}>
            <Button onClick={() => setPreview(false)}>
              Kembali
            </Button>
          </footer>
        </Modal>
      )}
    </Page>
  );
}
