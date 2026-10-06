"use client";
import { visitorFetch } from "../../components/auth/visitor-api";
import { Button } from "../../components/ui/button";
import { Field, Input, Select, DateRangePicker } from "../../components/ui/field";
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
import {
  Plus,
  Search,
  ChevronsUpDown,
  Play,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  Camera,
  ChevronDown,
} from "lucide-react";
import CameraTestPreview from "../../components/camera-test-preview";
import Modal from "../../components/ui-modal";
import EventSummary from "../../components/event-summary";
import { todayWib } from "../../components/hourly-visitor-statistics";
import { getAuthHeaders } from "../../components/auth/auth-api";
import { toast } from "../ui/toast";
const API_BASE = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/events`;

type CameraSetting = {
  countingDirection: "auto" | "in" | "out";
  linePosition: number;
  lineOrientation: string;
  lineAngle: number;
  reverseDirection: boolean;
  mirror: boolean;
  twoLineCounting?: boolean;
  zoneWidthRatio?: number;
};

type CameraDbSetting = {
  counting_direction?: "auto" | "in" | "out" | null;
  line_position?: number | null;
  line_orientation?: string | null;
  line_angle?: number | null;
  reverse_direction?: boolean | null;
  mirror?: boolean | null;
  two_line_counting?: boolean | null;
  zone_width_ratio?: number | null;
};

type VisitorEvent = {
  id: string;
  name: string;
  location?: string | null;
  camera_source?: string | null;
  camera_id?: string | null;
  camera_ids?: string[] | null;
  camera_settings?: Record<string, CameraDbSetting> | null;
  line_position?: number | null;
  line_orientation?: string | null;
  line_angle?: number | null;
  reverse_direction?: boolean | null;
  event_date?: string | null;
  event_end_date?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  auto_run?: boolean;
  capacity?: number | null;
  allow_duplicate?: boolean;
  gender_enabled?: boolean;
  advanced_settings?: Partial<Record<keyof typeof ADVANCED_DEFAULTS, number>> | null;
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
const ADVANCED_DEFAULTS = {
  detect_width: "640", detect_every_n_frames: "3", person_confidence: "0.45",
  face_similarity: "0.70", gender_confidence: "0.80", gender_retry_seconds: "2",
};
const ADVANCED_FIELDS: { key: keyof typeof ADVANCED_DEFAULTS; label: string; min: number; max: number; step: number; hint: string }[] = [
  { key: "detect_width", label: "Detail gambar untuk mengenali orang", min: 320, max: 1280, step: 1, hint: "Pilih lebih detail jika orang terlihat kecil atau jauh. Pilihan ini menambah beban komputer." },
  { key: "detect_every_n_frames", label: "Seberapa sering orang diperiksa", min: 1, max: 15, step: 1, hint: "Pemeriksaan lebih sering membantu saat orang berjalan cepat, tetapi menambah beban komputer." },
  { key: "person_confidence", label: "Ketelitian mendeteksi orang", min: 0.1, max: 0.95, step: 0.01, hint: "Nilai kecil membantu menangkap orang yang kurang jelas. Nilai besar mengurangi benda yang keliru dianggap orang." },
  { key: "face_similarity", label: "Ketelitian mengenali orang yang sama", min: 0.5, max: 0.95, step: 0.01, hint: "Skor minimum yang lebih tinggi mengurangi risiko dua orang berbeda dianggap sama, tetapi orang yang sama bisa dikenali sebagai pengunjung baru." },
  { key: "gender_confidence", label: "Ketelitian perkiraan gender", min: 0.5, max: 0.99, step: 0.01, hint: "Nilai besar mengurangi tebakan. Jika belum yakin, gender ditampilkan sebagai belum diketahui." },
  { key: "gender_retry_seconds", label: "Coba lagi jika gender belum diketahui", min: 0.4, max: 10, step: 0.1, hint: "Jeda lebih lama mengurangi beban komputer. Pemeriksaan awal tetap dilakukan lebih cepat." },
];
const ADVANCED_OPTIONS: Record<keyof typeof ADVANCED_DEFAULTS, { value: string; label: string }[]> = {
  detect_width: [{ value: "320", label: "320 piksel" }, { value: "640", label: "640 piksel (disarankan)" }, { value: "960", label: "960 piksel" }, { value: "1280", label: "1280 piksel" }],
  detect_every_n_frames: [{ value: "1", label: "Setiap gambar" }, { value: "3", label: "Setiap 3 gambar (disarankan)" }, { value: "6", label: "Setiap 6 gambar" }],
  person_confidence: [{ value: "0.35", label: "Keyakinan minimal 35%" }, { value: "0.45", label: "Keyakinan minimal 45% (disarankan)" }, { value: "0.60", label: "Keyakinan minimal 60%" }],
  face_similarity: [{ value: "0.60", label: "Skor wajah minimal 60 dari 100" }, { value: "0.70", label: "Skor wajah minimal 70 (disarankan)" }, { value: "0.80", label: "Skor wajah minimal 80 dari 100" }],
  gender_confidence: [{ value: "0.70", label: "Keyakinan minimal 70%" }, { value: "0.80", label: "Keyakinan minimal 80% (disarankan)" }, { value: "0.90", label: "Keyakinan minimal 90%" }],
  gender_retry_seconds: [{ value: "1", label: "Setiap 1 detik" }, { value: "2", label: "Setiap 2 detik (disarankan)" }, { value: "4", label: "Setiap 4 detik" }],
};
const initialForm = {
  name: "",
  location: "",
  cameraIds: [] as string[],
  cameraSettings: {} as Record<string, CameraSetting>,
  eventDate: "",
  eventEndDate: "",
  eventStart: "",
  eventEnd: "",
  autoRun: true,
  capacity: "",
  allowDuplicate: false,
  genderEnabled: false,
  advancedSettings: { ...ADVANCED_DEFAULTS },
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
export default function EventsManager({ editEventId, onClose, onSaved }: {
  editEventId?: string;
  onClose?: () => void;
  onSaved?: () => void;
}) {
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
  const [manualAdvanced, setManualAdvanced] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const update = <K extends keyof typeof initialForm>(
    key: K,
    value: (typeof initialForm)[K],
  ) => setForm((previous) => ({ ...previous, [key]: value }));
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await visitorFetch(
        `${API_BASE}?company_id=${encodeURIComponent(companyId())}`,
        { cache: "no-store", headers: getAuthHeaders() },
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

  const startEvent = useCallback(async (eventId: string, eventName: string) => {
    setStartingId(eventId);
    setActionAlert(null);
    try {
      const cid = companyId();
      if (!cid) throw new Error("Workspace belum tersedia. Lengkapi akun Anda.");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor/start?company_id=${encodeURIComponent(cid)}&event_id=${encodeURIComponent(eventId)}`,
        {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ event_id: eventId }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof payload?.detail === "string"
            ? payload.detail
            : typeof payload?.message === "string"
              ? payload.message
              : "Gagal memulai event.",
        );
      }
      setActionAlert({
        type: "success",
        message: `Event "${eventName}" berhasil dimulai! Monitoring kamera sedang aktif.`,
      });
      toast.success(`Monitoring event "${eventName}" dimulai.`);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status: "running" } : e)),
      );
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memulai event.");
      setActionAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Gagal memulai event.",
      });
    } finally {
      setStartingId(null);
    }
  }, [load]);
  useEffect(() => {
    const initial = setTimeout(() => {
      void load();
      fetch(
        `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/cctv/cameras/${encodeURIComponent(companyId())}`,
        { headers: getAuthHeaders() },
      )
        .then((response) => response.json())
        .then((payload) =>
          setCameras(Array.isArray(payload.result) ? payload.result : []),
        )
        .catch(() => {});
      if (!editEventId && new URLSearchParams(window.location.search).get("create") === "1") {
        setForm({ ...initialForm, eventDate: todayWib() });
        setIsOpen(true);
        window.history.replaceState(null, "", "/events");
      }
    }, 0);
    return () => clearTimeout(initial);
  }, [load, editEventId]);
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
  const open = useCallback((event?: VisitorEvent) => {
    setManualAdvanced(false);
    setMonitoringActive(event?.status === "running");
    const defaultIds = event?.camera_ids || (event?.camera_id ? [event.camera_id] : []);
    const settings: Record<string, CameraSetting> = {};
    if (event) {
      if (event.camera_settings) {
        for (const [id, cfg] of Object.entries(event.camera_settings)) {
          settings[id] = {
            countingDirection: cfg.counting_direction || "auto",
            linePosition: cfg.line_position ? Math.round(cfg.line_position * 100) : 50,
            lineOrientation: cfg.line_orientation || "horizontal",
            lineAngle: cfg.line_angle ?? 0,
            reverseDirection: cfg.reverse_direction || false,
            mirror: cfg.mirror || false,
            twoLineCounting: cfg.two_line_counting ?? true,
            zoneWidthRatio: cfg.zone_width_ratio ?? 0.20,
          };
        }
      }
      for (const id of defaultIds) {
        if (!settings[id]) {
          settings[id] = {
            countingDirection: "auto",
            linePosition: Math.round((event.line_position ?? 0.5) * 100),
            lineOrientation: event.line_orientation || "horizontal",
            lineAngle: event.line_angle ?? 0,
            reverseDirection: event.reverse_direction || false,
            mirror: false,
            twoLineCounting: true,
            zoneWidthRatio: 0.20,
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
            eventEndDate: event.event_end_date || event.event_date || "",
            eventStart: event.event_start || "",
            eventEnd: event.event_end || "",
            autoRun: event.auto_run !== false,
            capacity: event.capacity == null ? "" : String(event.capacity),
            allowDuplicate: event.allow_duplicate === true,
            genderEnabled: event.gender_enabled === true,
            advancedSettings: Object.fromEntries(Object.entries(ADVANCED_DEFAULTS).map(([key, value]) => [key, String(event.advanced_settings?.[key as keyof typeof ADVANCED_DEFAULTS] ?? value)])) as typeof ADVANCED_DEFAULTS,
          }
        : { ...initialForm, eventDate: todayWib(), eventEndDate: todayWib() },
    );
    setEditingId(event?.id || null);
    setFormError("");
    setIsOpen(true);
  }, []);
  useEffect(() => {
    if (loading) return;
    const editId = editEventId || new URLSearchParams(window.location.search).get("edit");
    if (!editId) return;
    const target = events.find((event) => event.id === editId);
    const timer = setTimeout(() => {
      if (!target) {
        if (editEventId) setError("Event belum dapat dimuat. Tutup dan coba lagi.");
        return;
      }
      open(target);
      if (!editEventId) window.history.replaceState(null, "", "/events");
    }, 0);
    return () => clearTimeout(timer);
  }, [events, loading, open, editEventId]);
  function closeEditor() {
    setIsOpen(false);
    onClose?.();
  }
  async function stopMonitoring() {
    if (!editingId) return;
    setBusy(true);
    setFormError("");
    try {
      const response = await visitorFetch(
        `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor/stop?company_id=${encodeURIComponent(companyId())}&event_id=${encodeURIComponent(editingId)}`,
        { method: "POST", headers: getAuthHeaders() },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.result?.running) {
        throw new Error(result?.detail || result?.message || "Monitoring belum dapat dihentikan.");
      }
      setMonitoringActive(false);
      toast.success("Monitoring dihentikan. Pengaturan event sekarang bisa disimpan.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Monitoring belum dapat dihentikan.";
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      if (!form.eventDate) {
        setFormError("Tanggal event harus dipilih.");
        setBusy(false);
        return;
      }
      const dbSettings: Record<string, CameraDbSetting> = {};
      for (const id of form.cameraIds) {
        const cfg = form.cameraSettings[id];
        if (cfg) {
          dbSettings[id] = {
            counting_direction: cfg.countingDirection,
            line_position: cfg.linePosition / 100,
            line_orientation: cfg.lineOrientation,
            line_angle: cfg.lineAngle,
            reverse_direction: cfg.reverseDirection,
            mirror: cfg.mirror || false,
            two_line_counting: cfg.twoLineCounting ?? true,
            zone_width_ratio: cfg.zoneWidthRatio ?? 0.20,
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
        event_end_date: form.eventEndDate || form.eventDate || null,
        event_start: form.eventStart,
        event_end: form.eventEnd,
        auto_run: form.autoRun,
        capacity: form.capacity ? Number(form.capacity) : null,
        allow_duplicate: form.allowDuplicate,
        gender_enabled: form.genderEnabled,
        advanced_settings: Object.fromEntries(Object.entries(form.advancedSettings).map(([key, value]) => [key, Number(value)])),
        company_id: companyId(),
      };
      const response = await visitorFetch(
        editingId
          ? `${API_BASE}/${encodeURIComponent(editingId)}?company_id=${encodeURIComponent(companyId())}`
          : API_BASE,
        {
          method: editingId ? "PUT" : "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        if (response.status === 409 && editingId) setMonitoringActive(true);
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : typeof result?.message === "string"
              ? result.message
              : "Event belum dapat disimpan.",
        );
      }
      toast.success(editingId ? "Perubahan event disimpan." : "Event berhasil dibuat.");
      if (editEventId) {
        onSaved?.();
        closeEditor();
      } else {
        setIsOpen(false);
        await load();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Event gagal disimpan.";
      setFormError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!confirm("Hapus event ini?")) return;
    try {
      const response = await visitorFetch(
        `${API_BASE}/${encodeURIComponent(id)}?company_id=${encodeURIComponent(companyId())}`,
        { method: "DELETE", headers: getAuthHeaders() },
      );
      if (!response.ok) throw new Error("Event belum dapat dihapus.");
      toast.success("Event dan data pengunjung berhasil dihapus.");
      setSelected((previous) => previous.filter((value) => value !== id));
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Event gagal dihapus.";
      setError(message);
      toast.error(message);
    }
  }
  const summarySelection = events.filter((event) =>
    selected.includes(event.id),
  );
  return (
    <>
      {editEventId && !isOpen && (
        <Modal title="Edit Event" onClose={closeEditor}>
          <p role={error ? "alert" : "status"}>{error || "Memuat pengaturan event…"}</p>
        </Modal>
      )}
      {!editEventId && <Page>
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
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari event..."
                className="pl-9"
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
      {actionAlert && (
        <div
          role="alert"
          className={cx(
            "mb-4 flex items-center justify-between rounded-lg px-4 py-3 text-sm",
            actionAlert.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <div className="flex items-center gap-2">
            {actionAlert.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : null}
            <span>{actionAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionAlert(null)}
            className="text-xs font-semibold underline hover:opacity-80 cursor-pointer ml-4"
          >
            Tutup
          </button>
        </div>
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
                <th className="min-w-[290px]">Aksi</th>
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
                    {event.event_date
                      ? event.event_end_date && event.event_end_date !== event.event_date
                        ? `${new Date(event.event_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })} - ${new Date(event.event_end_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}`
                        : new Date(event.event_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                      : event.created_at
                        ? new Date(event.created_at).toLocaleDateString("en-GB", {
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
                  <td className="whitespace-nowrap">
                    <div className="flex items-center gap-1.5 py-0.5">
                      {event.status === "running" ? (
                        <Link
                          href={`/events/${event.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                          title="Event sedang berlangsung, buka live monitoring"
                        >
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live Monitor
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={startingId === event.id}
                          onClick={() => startEvent(event.id, event.name)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                          title="Mulai monitoring event ini langsung dari tabel"
                        >
                          {startingId === event.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Play size={13} fill="currentColor" />
                          )}
                          Mulai Event
                        </button>
                      )}

                      <Link
                        href={`/events/${event.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        title="Lihat detail event"
                      >
                        <Eye size={13} />
                        Detail
                      </Link>

                      <button
                        type="button"
                        onClick={() => open(event)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                        title="Edit event"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => remove(event.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Hapus event"
                      >
                        <Trash2 size={13} />
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </TableContainer>
      </Page>}
      {isOpen && (
        <Modal
          title={editingId ? "Edit Event" : "Buat Event Baru"}
          description={editingId ? "Sesuaikan jadwal, aturan penghitungan, dan kamera untuk event ini." : "Tentukan jadwal dan kamera untuk mulai menghitung pengunjung."}
          className="overflow-hidden open:flex open:flex-col"
          onClose={closeEditor}
          busy={busy}
        >
          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col [&_[data-slot=input]]:border-[#8994a4]">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <fieldset disabled={busy} className="min-w-0">
                <div className="space-y-7 px-6 py-6 max-[600px]:space-y-6 max-[600px]:p-4">
                  {formError && <p role="alert" className={ui.error}>{formError}</p>}
                  {monitoringActive && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                      <p>Monitoring sedang aktif. Hentikan sebelum menyimpan perubahan. Sesi aktif akan diakhiri; data pengunjung tetap tersimpan.</p>
                      <Button type="button" variant="outline" className="mt-3" disabled={busy} onClick={() => void stopMonitoring()}>
                        Hentikan Monitoring
                      </Button>
                      <p className="mt-2">Setelah menyimpan, mulai monitoring lagi dari halaman detail.</p>
                    </div>
                  )}
                  <section aria-labelledby="event-details-heading">
                    <h3 id="event-details-heading" className="text-base font-semibold">Informasi event</h3>
                    <p className="mt-1 mb-4 text-sm text-neutral-600">Nama dan lokasi yang tampil pada daftar event.</p>
                    <div className="grid gap-4 min-[600px]:grid-cols-2">
                      <Field className="min-[600px]:col-span-2">
                        Nama event <span className="sr-only">(wajib)</span>
                        <Input autoFocus required placeholder="Contoh: Pameran Akhir Tahun" value={form.name} onChange={(e) => update("name", e.target.value)} />
                      </Field>
                      <Field>
                        Lokasi
                        <Input placeholder="Contoh: Aula utama" value={form.location} onChange={(e) => update("location", e.target.value)} />
                      </Field>
                      <Field>
                        <span>Kapasitas <span className="font-normal text-neutral-600">(opsional)</span></span>
                        <Input type="number" min="1" placeholder="Jumlah pengunjung" value={form.capacity} onChange={(e) => update("capacity", e.target.value)} />
                      </Field>
                    </div>
                  </section>
                  <section aria-labelledby="event-schedule-heading" className="border-t border-neutral-200 pt-6">
                    <h3 id="event-schedule-heading" className="mb-4 text-base font-semibold">Jadwal monitoring</h3>
                    <div className="grid gap-4 min-[600px]:grid-cols-2">
                      <fieldset className="min-w-0 min-[600px]:col-span-2">
                        <legend className="mb-1.5 text-neutral-700">Tanggal event</legend>
                        <DateRangePicker className="[&>button]:border-[#8994a4]" startDate={form.eventDate} endDate={form.eventEndDate} onChange={(start, end) => {
                          update("eventDate", start);
                          update("eventEndDate", end);
                        }} />
                      </fieldset>
                      <Field>
                        Jam mulai
                        <Input type="time" required value={form.eventStart} onChange={(e) => update("eventStart", e.target.value)} />
                      </Field>
                      <Field>
                        Jam selesai
                        <Input type="time" required value={form.eventEnd} onChange={(e) => update("eventEnd", e.target.value)} />
                      </Field>
                    </div>
                    <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-neutral-50 p-3">
                      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-navy" checked={form.autoRun} onChange={(e) => update("autoRun", e.target.checked)} />
                      <span className="min-w-0">
                        <span className="block font-medium">Jalankan otomatis</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-neutral-600">Monitoring dimulai dan dihentikan sesuai jadwal event.</span>
                      </span>
                    </label>
                  </section>
                  <section aria-labelledby="event-counting-heading" className="border-t border-neutral-200 pt-6">
                    <h3 id="event-counting-heading" className="mb-4 text-base font-semibold">Aturan penghitungan</h3>
                    <label className={cx("flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-navy focus-within:ring-offset-2", form.allowDuplicate ? "border-navy bg-[#f0f4f8]" : "border-neutral-300 bg-white hover:border-neutral-500")}>
                      <input type="checkbox" aria-describedby="repeat-visits-description" className="mt-0.5 size-5 shrink-0 accent-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy" checked={form.allowDuplicate} onChange={(e) => update("allowDuplicate", e.target.checked)} />
                      <span className="min-w-0">
                        <span className="block font-medium">Catat kunjungan berulang</span>
                        <span id="repeat-visits-description" className="mt-1 block text-sm leading-relaxed text-neutral-600">{form.allowDuplicate ? "Aktif: orang yang sama masuk lagi akan menambah hitungan dan menyimpan foto baru." : "Nonaktif: hanya masuk dan keluar pertama per orang yang dicatat. Masuk lagi tidak menambah hitungan atau menyimpan foto baru."}</span>
                        <span className="mt-2 block text-xs leading-relaxed text-neutral-600">Matikan jika Anda ingin menghitung setiap orang hanya sekali selama event.</span>
                      </span>
                    </label>
                  </section>
                  <section aria-label="Profil pengunjung" className="border-t border-neutral-200 pt-6">
                    <label className={cx("flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-4 focus-within:ring-2 focus-within:ring-navy focus-within:ring-offset-2", form.genderEnabled ? "border-navy bg-[#f0f4f8]" : "border-neutral-300 bg-white hover:border-neutral-500")}>
                      <input type="checkbox" checked={form.genderEnabled} onChange={(e) => update("genderEnabled", e.target.checked)} aria-describedby="event-gender-description" className="mt-0.5 size-5 shrink-0 accent-navy" />
                      <span className="min-w-0">
                        <span className="block font-medium">Deteksi gender pengunjung</span>
                        <span id="event-gender-description" className="mt-1 block text-sm leading-relaxed text-neutral-600">{form.genderEnabled ? "Aktif: perkiraan gender ditambahkan ke capture dan laporan. Pemeriksaan ini dapat menambah beban pemrosesan." : "Nonaktif: penghitungan masuk dan keluar tetap berjalan tanpa pemeriksaan gender."}</span>
                      </span>
                    </label>
                  </section>
                  <section aria-label="Pengaturan lanjutan" className="border-t border-neutral-200 pt-6">
                    <details className="rounded-lg border border-neutral-300 p-4">
                      <summary className="cursor-pointer font-semibold">Pengaturan Lanjutan</summary>
                      <p className="mt-3 text-sm leading-relaxed text-neutral-600">Belum yakin harus memilih apa? Gunakan pilihan yang disarankan. Pengaturan berlaku untuk semua kamera event. Jika monitoring sedang berjalan, hentikan lalu mulai kembali setelah menyimpan.</p>
                      <div className="mt-4 grid gap-4 min-[600px]:grid-cols-2">
                        {ADVANCED_FIELDS.filter((field) => form.genderEnabled || !field.key.startsWith("gender_")).map((field) => <Field key={field.key}>
                          {field.label}
                          {manualAdvanced ? <Input type="number" required min={field.min} max={field.max} step={field.step} value={form.advancedSettings[field.key]} aria-describedby={`advanced-${field.key}-hint`} onChange={(event) => update("advancedSettings", { ...form.advancedSettings, [field.key]: event.target.value })} /> : <Select value={ADVANCED_OPTIONS[field.key].find((option) => Number(option.value) === Number(form.advancedSettings[field.key]))?.value || form.advancedSettings[field.key]} aria-describedby={`advanced-${field.key}-hint`} onChange={(event) => update("advancedSettings", { ...form.advancedSettings, [field.key]: event.target.value })}>
                            {!ADVANCED_OPTIONS[field.key].some((option) => Number(option.value) === Number(form.advancedSettings[field.key])) && <option value={form.advancedSettings[field.key]}>Nilai khusus ({form.advancedSettings[field.key]})</option>}
                            {ADVANCED_OPTIONS[field.key].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </Select>}
                          <span id={`advanced-${field.key}-hint`} className="text-xs leading-relaxed text-neutral-600">{field.hint}{manualAdvanced && ` Nilai bawaan: ${ADVANCED_DEFAULTS[field.key]}.`}</span>
                        </Field>)}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => { update("advancedSettings", { ...ADVANCED_DEFAULTS }); setManualAdvanced(false); }}>Restore Default</Button>
                        <Button type="button" onClick={() => setManualAdvanced((previous) => !previous)}>{manualAdvanced ? "Gunakan Pilihan Sederhana" : "Atur Angka Secara Manual"}</Button>
                      </div>
                    </details>
                  </section>
                  <section aria-labelledby="event-cameras-heading" className="border-t border-neutral-200 pt-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 id="event-cameras-heading" className="text-base font-semibold">Kamera event</h3>
                        <p className="mt-1 text-sm text-neutral-600">Pilih kamera, lalu tentukan peran dan garis hitungnya.</p>
                      </div>
                      <span className="text-sm font-medium text-navy">{form.cameraIds.length} dipilih</span>
                    </div>
                    {cameras.length > 0 ? (
                      <div className="grid max-h-60 gap-2 overflow-y-auto p-1 min-[600px]:grid-cols-2">
                        {cameras.map((camera) => {
                          const selected = form.cameraIds.includes(camera.id);
                          return (
                            <label key={camera.id} className={cx("flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors", selected ? "border-navy bg-[#f0f4f8]" : "border-neutral-300 bg-white hover:border-neutral-500")}>
                              <input type="checkbox" className="size-4 shrink-0 accent-navy" checked={selected} onChange={(e) => {
                                const ids = e.target.checked ? [...form.cameraIds, camera.id] : form.cameraIds.filter((id) => id !== camera.id);
                                const newSettings = { ...form.cameraSettings };
                                if (e.target.checked && !newSettings[camera.id]) {
                                  newSettings[camera.id] = { countingDirection: "in", linePosition: 50, lineOrientation: "horizontal", lineAngle: 0, reverseDirection: false, mirror: false };
                                }
                                setForm({ ...form, cameraIds: ids, cameraSettings: newSettings });
                              }} />
                              <span className="min-w-0">
                                <span className="block break-words font-medium text-neutral-800">{camera.name}</span>
                                <span className="mt-0.5 block text-xs text-neutral-600">{/^\d+$/.test(camera.rtsp_url || camera.camera_source || "") ? "Kamera lokal" : "Kamera jaringan"}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">
                        Belum ada kamera terdaftar. <Link href="/master-cctv" className="font-medium text-navy underline">Tambahkan kamera</Link> untuk mengatur monitoring.
                      </div>
                    )}
                  </section>
                </div>

                {form.cameraIds.length > 0 && (
                  <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-6 max-[600px]:p-4">
                    <h3 className="mb-1 text-base font-semibold">Garis hitung per kamera</h3>
                    <p className="mb-4 text-sm text-neutral-600">Peran kamera berlaku khusus untuk event ini.</p>
                    <div className="flex flex-col gap-3">
                      {form.cameraIds.map((cameraId, cameraIndex) => {
                        const camera = cameras.find((c) => c.id === cameraId);
                        if (!camera) return null;
                        const source = camera.rtsp_url || camera.camera_source || "";
                        const camSetting = form.cameraSettings[cameraId];
                        const cfg = {
                          linePosition: camSetting?.linePosition ?? 50,
                          lineOrientation: camSetting?.lineOrientation ?? "horizontal",
                          lineAngle: camSetting?.lineAngle ?? 0,
                          countingDirection: camSetting?.countingDirection ?? "in",
                          reverseDirection: camSetting?.reverseDirection ?? false,
                          mirror: camSetting?.mirror ?? false,
                          twoLineCounting: camSetting?.twoLineCounting ?? true,
                          zoneWidthRatio: camSetting?.zoneWidthRatio ?? 0.20,
                        };

                        const updateCam = <K extends keyof CameraSetting>(
                          key: K,
                          value: CameraSetting[K]
                        ) => {
                          setForm({
                            ...form,
                            cameraSettings: {
                              ...form.cameraSettings,
                              [cameraId]: { ...cfg, [key]: value },
                            },
                          });
                        };

                        return (
                          <details key={cameraId} open={cameraIndex === 0} className="group rounded-xl border border-neutral-300 bg-white">
                            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-4 [&::-webkit-details-marker]:hidden">
                              <Camera size={18} className="shrink-0 text-neutral-600" aria-hidden="true" />
                              <span className="min-w-0 flex-1 break-words font-semibold text-neutral-800">{camera.name}</span>
                              <span className="rounded bg-[#f0f4f8] px-2 py-1 text-xs font-medium text-navy">{cfg.countingDirection === "in" ? "Masuk" : cfg.countingDirection === "out" ? "Keluar" : "Otomatis"}</span>
                              <ChevronDown size={18} className="shrink-0 text-neutral-600 transition-transform group-open:rotate-180" aria-hidden="true" />
                            </summary>
                            <div className="grid min-w-0 items-start gap-6 border-t border-neutral-200 p-4 min-[800px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <div className="min-w-0 space-y-4">
                              <Field>
                                Peran kamera
                                <Select
                                  value={cfg.countingDirection}
                                  onChange={(e) => updateCam("countingDirection", e.target.value as CameraSetting["countingDirection"])}
                                >
                                  <option value="in">Masuk (IN)</option>
                                  <option value="out">Keluar (OUT)</option>
                                  <option value="auto">Otomatis sesuai arah lintasan</option>
                                </Select>
                              </Field>
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
                                  className="min-h-11 w-full cursor-pointer accent-navy"
                                  min="10"
                                  max="90"
                                  value={cfg.linePosition}
                                  onChange={(e) => updateCam("linePosition", Number(e.target.value))}
                                />
                              </Field>
                              <Field>
                                Kemiringan Garis ({cfg.lineAngle}°)
                                <input
                                  type="range"
                                  className="min-h-11 w-full cursor-pointer accent-navy"
                                  min="-89"
                                  max="89"
                                  step="1"
                                  value={cfg.lineAngle}
                                  onChange={(e) => updateCam("lineAngle", Number(e.target.value))}
                                />
                                <Input
                                  aria-label="Kemiringan garis dalam derajat"
                                  type="number"
                                  min={-89}
                                  max={89}
                                  step={1}
                                  value={cfg.lineAngle}
                                  onChange={(e) => {
                                    const angle = e.target.valueAsNumber;
                                    if (Number.isFinite(angle)) updateCam("lineAngle", Math.max(-89, Math.min(89, angle)));
                                  }}
                                />
                                <span className="text-xs text-neutral-600">0° mengikuti orientasi; nilai positif memutar searah jarum jam.</span>
                              </Field>
                              <div className="space-y-2 pt-1">
                                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-neutral-700">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(cfg.twoLineCounting)}
                                    onChange={(e) => updateCam("twoLineCounting", e.target.checked)}
                                    className="size-4 rounded border-neutral-300 text-navy focus:ring-navy"
                                  />
                                  Gunakan 2 Garis & Crossing Zone (A & B)
                                </label>
                                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-neutral-700">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(cfg.reverseDirection)}
                                    disabled={cfg.countingDirection !== "auto"}
                                    onChange={(e) => updateCam("reverseDirection", e.target.checked)}
                                    className="size-4 rounded border-neutral-300 text-navy focus:ring-navy"
                                  />
                                  Balik arah masuk/keluar (mode otomatis)
                                </label>
                                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-neutral-700">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(cfg.mirror)}
                                    onChange={(e) => updateCam("mirror", e.target.checked)}
                                    className="size-4 rounded border-neutral-300 text-navy focus:ring-navy"
                                  />
                                  Mirror kamera (balik horizontal)
                                </label>
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="mb-2 text-sm font-medium text-neutral-700">Preview garis</p>
                              <CameraTestPreview
                                compact
                                source={source}
                                position={cfg.linePosition}
                                orientation={cfg.lineOrientation}
                                angle={cfg.lineAngle}
                                reversed={cfg.reverseDirection}
                                countingDirection={cfg.countingDirection}
                                twoLineCounting={cfg.twoLineCounting}
                                zoneWidthRatio={cfg.zoneWidthRatio}
                                mirror={cfg.mirror}
                              />
                            </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}
              </fieldset>
            </div>
            <footer className={cx(ui.modalFooter, "shrink-0 items-center bg-white max-[600px]:flex-wrap")}>
              <span className="mr-auto text-xs text-neutral-600 max-[600px]:w-full">{form.cameraIds.length ? `${form.cameraIds.length} kamera untuk event ini` : "Belum ada kamera dipilih"}</span>
              <Button
                type="button"
                onClick={closeEditor}
                disabled={busy}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={busy || monitoringActive || !form.name.trim()}
              >
                {busy ? "Menyimpan…" : editingId ? "Simpan Perubahan" : "Buat Event"}
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
    </>
  );
}
