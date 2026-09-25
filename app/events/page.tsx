"use client";
import { Button } from "../../components/ui/button";
import { Field, Input, Select } from "../../components/ui/field";
import { Page, PageHeading, Toolbar } from "../../components/ui/layout";
import { DataTable, StatusBadge, TableContainer } from "../../components/ui/data-table";
import { cx, ui } from "../../components/ui/styles";
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
  camera_settings?: Record<string, any> | null;
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
  cameraIds: [] as string[],
  cameraSettings: {} as Record<
    string,
    { linePosition: number; lineOrientation: string; reverseDirection: boolean }
  >,
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
    const defaultIds = event?.camera_ids || (event?.camera_id ? [event.camera_id] : []);
    const settings: Record<string, any> = {};
    if (event) {
      if (event.camera_settings) {
        for (const [id, cfg] of Object.entries(event.camera_settings)) {
          settings[id] = {
            linePosition: cfg.line_position ? Math.round(cfg.line_position * 100) : 50,
            lineOrientation: cfg.line_orientation || "horizontal",
            reverseDirection: cfg.reverse_direction || false,
          };
        }
      }
      for (const id of defaultIds) {
        if (!settings[id]) {
          settings[id] = {
            linePosition: Math.round((event.line_position ?? 0.5) * 100),
            lineOrientation: event.line_orientation || "horizontal",
            reverseDirection: event.reverse_direction || false,
          };
        }
      }
    }
    
    setForm(
      event
        ? {
            name: event.name,
            location: event.location || "",
            cameraIds: defaultIds,
            cameraSettings: settings,
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
      const dbSettings: Record<string, any> = {};
      for (const id of form.cameraIds) {
        const cfg = form.cameraSettings[id];
        if (cfg) {
          dbSettings[id] = {
            line_position: cfg.linePosition / 100,
            line_orientation: cfg.lineOrientation,
            reverse_direction: cfg.reverseDirection,
          };
        }
      }
      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        camera_id: form.cameraIds[0] || null,
        camera_ids: form.cameraIds.length ? form.cameraIds : null,
        camera_settings: Object.keys(dbSettings).length ? dbSettings : null,
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
    <Page>
      <PageHeading>
        <div>
          <p className={ui.eyebrow}>EVENT</p>
          <h1>Daftar Event</h1>
          <p className={ui.pageDescription}>
            Jumlah event masuk yang tercatat pada tanggal pilihan.
          </p>
        </div>
        <Toolbar>
          <Field>
            Cari Event
            <span className="relative">
              <Search
                size={15}
                className="absolute left-3 top-3 text-neutral-500"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </Field>
          <Button
            variant="outline"
            disabled={!summarySelection.length}
            onClick={() => setSummaryEvents(summarySelection)}
          >
            Rangkum Event
          </Button>
          <Button variant="primary" onClick={() => open()}>
            <Plus size={16} />
            Buat Event
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
        ) : !visibleEvents.length ? (
          <div className={ui.emptyState}>
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
          <DataTable>
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
                    <StatusBadge
                      data-running={event.status === "running"}
                    >
                      {event.status || "not started"}
                    </StatusBadge>
                  </td>
                  <td>
                    <details
                      className={ui.rowMenu}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") e.currentTarget.open = false;
                      }}
                    >
                      <summary aria-label={`Aksi ${event.name}`}>
                        <MoreHorizontal size={18} />
                      </summary>
                      <div className={ui.rowMenuContent}>
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
          </DataTable>
        )}
      </TableContainer>
      {isOpen && (
        <Modal
          title={editingId ? "Edit Event" : "Buat Event Baru"}
          onClose={() => setIsOpen(false)}
          busy={busy}
        >
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <div className={ui.modalBody}>
                {formError && (
                  <p role="alert" className={ui.error}>
                    {formError}
                  </p>
                )}
                <div className={ui.formGrid}>
                  <Field>
                    Nama Event
                    <Input
                      autoFocus
                      required
                      placeholder="Masukkan nama event"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </Field>
                  <Field>
                    Kapasitas Event (Opsional)
                    <Input
                      type="number"
                      min="1"
                      placeholder="Masukkan jumlah kapasitas"
                      value={form.capacity}
                      onChange={(e) => update("capacity", e.target.value)}
                    />
                  </Field>
                  <Field>
                    Lokasi Event
                    <Input
                      placeholder="Masukkan lokasi event"
                      value={form.location}
                      onChange={(e) => update("location", e.target.value)}
                    />
                  </Field>
                  <Field>
                    Tanggal
                    <Input
                      type="date"
                      required
                      value={form.eventDate}
                      onChange={(e) => update("eventDate", e.target.value)}
                    />
                  </Field>
                  <Field>
                    Mulai
                    <Input
                      type="time"
                      required
                      value={form.eventStart}
                      onChange={(e) => update("eventStart", e.target.value)}
                    />
                  </Field>
                  <Field>
                    Selesai
                    <Input
                      type="time"
                      required
                      value={form.eventEnd}
                      onChange={(e) => update("eventEnd", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <div className={cx(ui.formSection, "space-y-4")}>
                <h3>Kamera & Garis Hitung</h3>
                <Field>
                  Pilih Kamera Terdaftar
                  {cameras.length > 0 ? (
                    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 max-h-48 overflow-y-auto">
                      {cameras.map((camera) => (
                        <label
                          key={camera.id}
                          className="flex items-center gap-3 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={form.cameraIds.includes(camera.id)}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...form.cameraIds, camera.id]
                                : form.cameraIds.filter((id) => id !== camera.id);
                              
                              const newSettings = { ...form.cameraSettings };
                              if (e.target.checked && !newSettings[camera.id]) {
                                newSettings[camera.id] = {
                                  linePosition: 50,
                                  lineOrientation: "horizontal",
                                  reverseDirection: false,
                                };
                              }
                              
                              setForm({
                                ...form,
                                cameraIds: ids,
                                cameraSettings: newSettings,
                              });
                            }}
                          />
                          <span className="font-medium text-gray-700">{camera.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">Belum ada kamera terdaftar.</p>
                  )}
                </Field>
                <div className="mt-4">
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
              
              {form.cameraIds.length > 0 && (
                <div className={cx(ui.formSection, "bg-neutral-50")}>
                  <h3 className="mb-4">Pengaturan Per Kamera</h3>
                  <div className="flex flex-col gap-6">
                    {form.cameraIds.map((cameraId) => {
                      const camera = cameras.find((c) => c.id === cameraId);
                      if (!camera) return null;
                      const source = camera.rtsp_url || camera.camera_source || "";
                      const cfg = form.cameraSettings[cameraId] || {
                        linePosition: 50,
                        lineOrientation: "horizontal",
                        reverseDirection: false,
                      };
                      
                      const updateCam = (key: string, value: any) => {
                        setForm({
                          ...form,
                          cameraSettings: {
                            ...form.cameraSettings,
                            [cameraId]: { ...cfg, [key]: value },
                          },
                        });
                      };

                      return (
                        <div key={cameraId} className="grid items-start gap-6 sm:grid-cols-2 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                          <div className="space-y-4">
                            <h4 className="font-semibold text-neutral-800">{camera.name}</h4>
                            <Field>
                              Orientasi Garis
                              <Select
                                value={cfg.lineOrientation}
                                onChange={(e) => updateCam("lineOrientation", e.target.value)}
                              >
                                <option value="horizontal">Horizontal</option>
                                <option value="vertical">Vertikal</option>
                              </Select>
                            </Field>
                            <Field>
                              Posisi Garis ({cfg.linePosition}%)
                              <input
                                type="range"
                                min="10"
                                max="90"
                                value={cfg.linePosition}
                                onChange={(e) => updateCam("linePosition", Number(e.target.value))}
                              />
                            </Field>
                            <label className="flex items-center gap-2 text-sm mt-2">
                              <input
                                type="checkbox"
                                checked={cfg.reverseDirection}
                                onChange={(e) => updateCam("reverseDirection", e.target.checked)}
                              />
                              Balik arah masuk/keluar
                            </label>
                          </div>
                          <div>
                            <p className="mb-2 text-sm font-medium text-neutral-600">Preview Garis</p>
                            <CameraTestPreview
                              compact
                              source={source}
                              position={cfg.linePosition}
                              orientation={cfg.lineOrientation}
                              reversed={cfg.reverseDirection}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </fieldset>
            <footer className={ui.modalFooter}>
              <Button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={busy || !form.name.trim()}
              >
                {busy ? "Menyimpan…" : "Simpan Event"}
              </Button>
            </footer>
          </form>
        </Modal>
      )}
      {summaryEvents && (
        <EventSummary
          events={summaryEvents}
          onClose={() => setSummaryEvents(null)}
        />
      )}
    </Page>
  );
}
