"use client";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FormEvent,
} from "react";
import Link from "next/link";
import { Plus, Search, MoreHorizontal, ChevronsUpDown } from "lucide-react";
import CameraTestPreview from "../../components/camera-test-preview";
import Modal from "../../components/ui-modal";
import EventSummary from "../../components/event-summary";
import { todayWib } from "../../components/hourly-visitor-statistics";
const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/events`;
type VisitorEvent = {
  id: string;
  name: string;
  location?: string | null;
  camera_source?: string | null;
  camera_id?: string | null;
  camera_ids?: string[] | null;
  line_position?: number | null;
  line_orientation?: string | null;
  reverse_direction?: boolean | null;
  event_date?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  auto_run?: boolean;
  capacity?: number | null;
  status?: string;
  visitor_count?: number;
  created_at?: string;
};
type CameraOption = {
  id: string;
  name: string;
  rtsp_url?: string;
  camera_source?: string;
};
const initialForm = {
  name: "",
  location: "",
  cameraSource: "",
  cameraIds: [] as string[],
  linePosition: 50,
  lineOrientation: "horizontal",
  reverseDirection: false,
  eventDate: "",
  eventStart: "",
  eventEnd: "",
  autoRun: true,
  capacity: "",
};
function companyId() {
  try {
    const user = JSON.parse(localStorage.getItem("user_info") || "null");
    return (
      (user?.account_type === "personal" ? user.id : user?.company_id) ||
      localStorage.getItem("cctv_company_id") ||
      ""
    );
  } catch {
    return "";
  }
}
export default function EventsPage() {
  const [events, setEvents] = useState<VisitorEvent[]>([]);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [summaryEvents, setSummaryEvents] = useState<VisitorEvent[] | null>(
    null,
  );
  const [sort, setSort] = useState<{
    key: "name" | "event_date" | "visitor_count" | "status";
    direction: number;
  }>({ key: "event_date", direction: -1 });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const update = <K extends keyof typeof initialForm>(
    key: K,
    value: (typeof initialForm)[K],
  ) => setForm((previous) => ({ ...previous, [key]: value }));
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}?company_id=${encodeURIComponent(companyId())}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Daftar event belum dapat dimuat.");
      const payload = await response.json();
      setEvents(Array.isArray(payload.result) ? payload.result : []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Daftar event gagal dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => {
      void load();
      fetch(
        `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/cctv/cameras/${encodeURIComponent(companyId())}`,
      )
        .then((response) => response.json())
        .then((payload) =>
          setCameras(Array.isArray(payload.result) ? payload.result : []),
        )
        .catch(() => {});
      if (new URLSearchParams(window.location.search).get("create") === "1") {
        setForm({ ...initialForm, eventDate: todayWib() });
        setIsOpen(true);
        window.history.replaceState(null, "", "/events");
      }
    }, 0);
    return () => clearTimeout(initial);
  }, [load]);
  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) =>
          event.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => {
          const left = a[sort.key] ?? "";
          const right = b[sort.key] ?? "";
          return (
            sort.direction *
            (typeof left === "number" && typeof right === "number"
              ? left - right
              : String(left).localeCompare(String(right)))
          );
        }),
    [events, query, sort],
  );
  function open(event?: VisitorEvent) {
    setForm(
      event
        ? {
            name: event.name,
            location: event.location || "",
            cameraSource: event.camera_source || "",
            cameraIds:
              event.camera_ids || (event.camera_id ? [event.camera_id] : []),
            linePosition: Math.round((event.line_position ?? 0.5) * 100),
            lineOrientation: event.line_orientation || "horizontal",
            reverseDirection: event.reverse_direction || false,
            eventDate: event.event_date || "",
            eventStart: event.event_start || "",
            eventEnd: event.event_end || "",
            autoRun: event.auto_run !== false,
            capacity: event.capacity == null ? "" : String(event.capacity),
          }
        : { ...initialForm, eventDate: todayWib() },
    );
    setEditingId(event?.id || null);
    setFormError("");
    setIsOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        camera_source: form.cameraSource.trim() || null,
        camera_id: form.cameraIds[0] || null,
        camera_ids: form.cameraIds.length ? form.cameraIds : null,
        line_position: form.linePosition / 100,
        line_orientation: form.lineOrientation,
        reverse_direction: form.reverseDirection,
        event_date: form.eventDate || null,
        event_start: form.eventStart,
        event_end: form.eventEnd,
        auto_run: form.autoRun,
        capacity: form.capacity ? Number(form.capacity) : null,
        company_id: companyId(),
      };
      const response = await fetch(
        editingId
          ? `${API_BASE}/${encodeURIComponent(editingId)}?company_id=${encodeURIComponent(companyId())}`
          : API_BASE,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : "Event belum dapat disimpan.",
        );
      }
      setIsOpen(false);
      await load();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Event gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Hapus event ini?")) return;
    try {
      const response = await fetch(
        `${API_BASE}/${encodeURIComponent(id)}?company_id=${encodeURIComponent(companyId())}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Event belum dapat dihapus.");
      setSelected((previous) => previous.filter((value) => value !== id));
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Event gagal dihapus.");
    }
  }
  const summarySelection = events.filter((event) =>
    selected.includes(event.id),
  );
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">EVENT</p>
          <h1>Daftar Event</h1>
          <p className="page-description">
            Jumlah event masuk yang tercatat pada tanggal pilihan.
          </p>
        </div>
        <div className="toolbar">
          <label className="field">
            Cari Event
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
            disabled={!summarySelection.length}
            onClick={() => setSummaryEvents(summarySelection)}
          >
            Rangkum Event
          </button>
          <button className="btn btn-primary" onClick={() => open()}>
            <Plus size={16} />
            Buat Event
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
        ) : !visibleEvents.length ? (
          <div className="empty-state">
            <strong>
              {events.length ? "Event tidak ditemukan" : "Belum ada event"}
            </strong>
            <p className="mt-2">
              {events.length
                ? "Coba kata kunci lain."
                : "Klik Buat Event untuk menambahkan event pertama."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua event"
                    checked={
                      visibleEvents.length > 0 &&
                      visibleEvents.every((event) =>
                        selected.includes(event.id),
                      )
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [
                              ...new Set([
                                ...selected,
                                ...visibleEvents.map((event) => event.id),
                              ]),
                            ]
                          : selected.filter(
                              (id) =>
                                !visibleEvents.some((event) => event.id === id),
                            ),
                      )
                    }
                  />
                </th>
                {(
                  [
                    { key: "name", label: "Nama Event" },
                    { key: "event_date", label: "Jadwal" },
                    { key: "visitor_count", label: "Jumlah Pengunjung" },
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
              {visibleEvents.map((event) => (
                <tr key={event.id} data-running={event.status === "running"}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${event.name}`}
                      checked={selected.includes(event.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, event.id]
                            : selected.filter((id) => id !== event.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <Link href={`/events/${event.id}`}>{event.name}</Link>
                  </td>
                  <td>
                    {event.event_date || event.created_at
                      ? new Date(
                          event.event_date || event.created_at || "",
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                    <br />
                    <span className="text-[10px] text-neutral-500">
                      {event.event_start || "-"} - {event.event_end || "-"}
                    </span>
                  </td>
                  <td>{event.visitor_count ?? 0}</td>
                  <td>
                    <span
                      className="status-badge"
                      data-running={event.status === "running"}
                    >
                      {event.status || "not started"}
                    </span>
                  </td>
                  <td>
                    <details
                      className="row-menu"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") e.currentTarget.open = false;
                      }}
                    >
                      <summary aria-label={`Aksi ${event.name}`}>
                        <MoreHorizontal size={18} />
                      </summary>
                      <div className="row-menu-content">
                        <Link href={`/events/${event.id}`}>Detail Event</Link>
                        <button
                          onClick={(e) => {
                            e.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                            open(event);
                          }}
                        >
                          Edit Event
                        </button>
                        <button
                          className="text-red-700"
                          onClick={() => remove(event.id)}
                        >
                          Hapus Event
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
          title={editingId ? "Edit Event" : "Buat Event Baru"}
          onClose={() => setIsOpen(false)}
          busy={busy}
        >
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <div className="modal-body">
                {formError && (
                  <p role="alert" className="error-message">
                    {formError}
                  </p>
                )}
                <div className="form-grid">
                  <label className="field">
                    Nama Event
                    <input
                      autoFocus
                      required
                      className="input"
                      placeholder="Masukkan nama event"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Kapasitas Event (Opsional)
                    <input
                      className="input"
                      type="number"
                      min="1"
                      placeholder="Masukkan jumlah kapasitas"
                      value={form.capacity}
                      onChange={(e) => update("capacity", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Lokasi Event
                    <input
                      className="input"
                      placeholder="Masukkan lokasi event"
                      value={form.location}
                      onChange={(e) => update("location", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Tanggal
                    <input
                      type="date"
                      className="input"
                      required
                      value={form.eventDate}
                      onChange={(e) => update("eventDate", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Mulai
                    <input
                      type="time"
                      className="input"
                      required
                      value={form.eventStart}
                      onChange={(e) => update("eventStart", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Selesai
                    <input
                      type="time"
                      className="input"
                      required
                      value={form.eventEnd}
                      onChange={(e) => update("eventEnd", e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <div className="form-section space-y-4">
                <h3>Kamera & Garis Hitung</h3>
                <label className="field">
                  Sumber Kamera
                  <input
                    className="input"
                    placeholder="0, rtsp://host/stream, atau path video"
                    value={form.cameraSource}
                    onChange={(e) => update("cameraSource", e.target.value)}
                  />
                  <small className="text-neutral-500">
                    Kosongkan untuk memakai kamera company.
                  </small>
                </label>
                {cameras.length > 0 && (
                  <details>
                    <summary className="py-1 text-sm">
                      Pilih kamera terdaftar ({form.cameraIds.length})
                    </summary>
                    <div className="flex flex-wrap gap-4 py-3">
                      {cameras.map((camera) => (
                        <label
                          key={camera.id}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={form.cameraIds.includes(camera.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...form.cameraIds, camera.id]
                                : form.cameraIds.filter(
                                    (id) => id !== camera.id,
                                  );
                              update("cameraIds", ids);
                              const first = cameras.find(
                                (item) => item.id === ids[0],
                              );
                              update(
                                "cameraSource",
                                first?.rtsp_url || first?.camera_source || "",
                              );
                            }}
                          />
                          {camera.name}
                        </label>
                      ))}
                    </div>
                  </details>
                )}
                <label className="field">
                  Orientasi Garis
                  <select
                    className="input"
                    value={form.lineOrientation}
                    onChange={(e) => update("lineOrientation", e.target.value)}
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertikal</option>
                  </select>
                </label>
                <label className="field">
                  Posisi Garis ({form.linePosition}%)
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={form.linePosition}
                    onChange={(e) =>
                      update("linePosition", Number(e.target.value))
                    }
                  />
                </label>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.reverseDirection}
                      onChange={(e) =>
                        update("reverseDirection", e.target.checked)
                      }
                    />
                    Balik arah masuk/keluar
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.autoRun}
                      onChange={(e) => update("autoRun", e.target.checked)}
                    />
                    Jalankan otomatis sesuai jadwal
                  </label>
                </div>
              </div>
              <div className="form-section grid items-center gap-5 sm:grid-cols-2">
                <div>
                  <h3>Preview Kamera</h3>
                  <p className="panel-description">
                    Video live untuk mengatur garis hitung sebelum event
                    dimulai.
                  </p>
                  {form.cameraIds.length > 1 && (
                    <button
                      className="btn mt-4"
                      type="button"
                      onClick={() => setPreview(true)}
                    >
                      Test semua kamera ({form.cameraIds.length})
                    </button>
                  )}
                </div>
                <CameraTestPreview
                  compact
                  source={form.cameraSource}
                  position={form.linePosition}
                  orientation={form.lineOrientation}
                  reversed={form.reverseDirection}
                />
              </div>
            </fieldset>
            <footer className="modal-footer">
              <button
                className="btn"
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || !form.name.trim()}
              >
                {busy ? "Menyimpan…" : "Simpan Event"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title="Test Kamera" onClose={() => setPreview(false)}>
          <div className="modal-body grid gap-4 sm:grid-cols-2">
            {cameras
              .filter((camera) => form.cameraIds.includes(camera.id))
              .map((camera) => (
                <div key={camera.id}>
                  <CameraTestPreview
                    source={camera.rtsp_url || camera.camera_source || ""}
                    position={form.linePosition}
                    orientation={form.lineOrientation}
                    reversed={form.reverseDirection}
                    autoStart
                  />
                  <p className="mt-2 text-xs">{camera.name}</p>
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
      {summaryEvents && (
        <EventSummary
          events={summaryEvents}
          onClose={() => setSummaryEvents(null)}
        />
      )}
    </main>
  );
}
