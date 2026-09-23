"use client";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FormEvent,
} from "react";
import { Plus, Search, MoreHorizontal, ChevronsUpDown } from "lucide-react";
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
      const response = await fetch(
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
    setIsOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch(
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
      await load();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Kamera gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Hapus kamera ini?")) return;
    try {
      const response = await fetch(
        `${API_BASE}/cameras/${encodeURIComponent(companyId)}/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Kamera belum dapat dihapus.");
      setSelected((previous) => previous.filter((value) => value !== id));
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Kamera gagal dihapus.",
      );
    }
  }
  return (
    <main className="page">
      <div className="page-heading mb-10">
        <div>
          <p className="eyebrow">SISTEM</p>
          <h1>Kamera</h1>
          <p className="page-description">
            Daftar kamera yang dapat digunakan untuk pemantauan
          </p>
        </div>
        <div className="toolbar">
          <label className="field">
            Cari Kamera
            <span className="relative">
              <Search
                size={15}
                className="absolute left-3 top-3 text-neutral-500"
              />
              <input
                type="search"
                className="input pl-9 sm:w-[290px]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </label>
          <button
            className="btn btn-outline"
            disabled={!selected.length}
            onClick={() => setPreview(true)}
          >
            Test Kamera
          </button>
          <button className="btn btn-primary" onClick={() => open()}>
            <Plus size={16} />
            Tambahkan Kamera
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}{" "}
          <button className="underline" onClick={load}>
            Coba lagi
          </button>
        </p>
      )}
      <div className="data-table-wrap">
        {loading ? (
          <p role="status" className="empty-state">
            Memuat data…
          </p>
        ) : !visible.length ? (
          <div className="empty-state">
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
          <table className="data-table">
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
                    <span
                      className="status-badge"
                      data-running={camera.status?.toLowerCase() === "running"}
                    >
                      {camera.status || "OFF"}
                    </span>
                  </td>
                  <td>
                    <details
                      className="row-menu"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") e.currentTarget.open = false;
                      }}
                    >
                      <summary aria-label={`Aksi ${camera.name}`}>
                        <MoreHorizontal size={18} />
                      </summary>
                      <div className="row-menu-content">
                        <button
                          onClick={(e) => {
                            e.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                            open(camera);
                          }}
                        >
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
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {isOpen && (
        <Modal
          title={editingId ? "Edit Kamera" : "Tambahkan Kamera"}
          onClose={() => setIsOpen(false)}
          busy={busy}
          size="small"
        >
          <form onSubmit={save}>
            <fieldset disabled={busy} className="modal-body space-y-4">
              {formError && (
                <p role="alert" className="error-message">
                  {formError}
                </p>
              )}
              <label className="field">
                Nama Kamera
                <input
                  autoFocus
                  required
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="field">
                Sumber Kamera
                <input
                  required
                  className="input"
                  placeholder="0, rtsp://host/stream, atau path video"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </label>
            </fieldset>
            <footer className="modal-footer">
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={busy || !companyId || !name.trim() || !source.trim()}
                type="submit"
              >
                {busy ? "Menyimpan…" : "Simpan Kamera"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title="Test Kamera" onClose={() => setPreview(false)}>
          <div
            className={`modal-body grid gap-3 ${selected.length > 1 ? "sm:grid-cols-2" : ""}`}
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
          <footer className="modal-footer">
            <button className="btn" onClick={() => setPreview(false)}>
              Kembali
            </button>
          </footer>
        </Modal>
      )}
    </main>
  );
}
