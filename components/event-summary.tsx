"use client";
import { useEffect, useState } from "react";
import {
  LogIn,
  LogOut,
  MapPinHouse,
  Mars,
  Venus,
  ClockArrowUp,
  RefreshCw,
} from "lucide-react";
import Modal from "./ui-modal";
import {
  VisitorChart,
  todayWib,
  type Hour,
  type Statistics,
} from "./hourly-visitor-statistics";
type Totals = {
  in_count: number;
  out_count: number;
  male_count: number;
  female_count: number;
  unknown_gender_count: number;
};
export default function EventSummary({
  events,
  onClose,
}: {
  events: { id: string; event_date?: string | null }[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState("profile");
  const [data, setData] = useState<{ totals: Totals; hours: Hour[] } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const user = JSON.parse(localStorage.getItem("user_info") || "null");
        const cid =
          (user?.account_type === "personal" ? user.id : user?.company_id) ||
          localStorage.getItem("cctv_company_id");
        if (!cid) throw new Error("Workspace belum tersedia.");
        const base = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/event_visitor`;
        async function get<T>(path: string): Promise<T> {
          const response = await fetch(`${base}${path}`, {
            signal: controller.signal,
          });
          if (!response.ok)
            throw new Error("Rangkuman belum dapat dimuat. Coba lagi.");
          return (await response.json()).result;
        }
        const rows = await Promise.all(
          events.map(async (event) => {
            const query = `company_id=${encodeURIComponent(cid)}&event_id=${encodeURIComponent(event.id)}`;
            return Promise.all([
              get<Totals>(`/status?${query}`),
              get<Statistics>(
                `/statistics/hourly?${query}&date=${event.event_date || todayWib()}`,
              ),
            ]);
          }),
        );
        const totals: Totals = {
          in_count: 0,
          out_count: 0,
          male_count: 0,
          female_count: 0,
          unknown_gender_count: 0,
        };
        const hours = Array.from({ length: 24 }, (_, hour) => ({
          hour,
          label: `${String(hour).padStart(2, "0")}:00`,
          in_count: 0,
        }));
        rows.forEach(([status, stats]) => {
          (Object.keys(totals) as (keyof Totals)[]).forEach(
            (key) => (totals[key] += status[key] || 0),
          );
          stats.hours.forEach((hour) => {
            if (hours[hour.hour]) hours[hour.hour].in_count += hour.in_count;
          });
        });
        if (!controller.signal.aborted) setData({ totals, hours });
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Rangkuman gagal dimuat.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [events, refresh]);
  const totals = data?.totals;
  const totalGender = totals
    ? totals.male_count + totals.female_count + totals.unknown_gender_count
    : 0;
  const gender = (count = 0) =>
    `${count.toLocaleString("id-ID")} Orang (${totalGender ? Math.round((count / totalGender) * 100) : 0}%)`;
  const peak = data?.hours.reduce(
    (max, hour) => (hour.in_count > max.in_count ? hour : max),
    { hour: 0, label: "-", in_count: 0 },
  );
  return (
    <Modal title="Rangkuman Event" onClose={onClose} size="medium">
      <div className="modal-body">
        <div
          className="settings-tabs mt-0"
          role="tablist"
          aria-label="Rangkuman event"
        >
          <button
            role="tab"
            aria-selected={tab === "profile"}
            onClick={() => setTab("profile")}
          >
            Statistik & Profil
          </button>
          <button
            role="tab"
            aria-selected={tab === "distribution"}
            onClick={() => setTab("distribution")}
          >
            Distribusi Pengunjung
          </button>
        </div>
        {error ? (
          <p role="alert" className="error-message">
            {error}{" "}
            <button
              className="underline"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Coba lagi
            </button>
          </p>
        ) : loading ? (
          <p role="status" className="empty-state">
            Memuat rangkuman…
          </p>
        ) : (
          data &&
          totals &&
          (tab === "profile" ? (
            <div className="stat-grid summary-grid">
              {[
                {
                  label: "Total masuk",
                  value: `${totals.in_count.toLocaleString("id-ID")} Orang`,
                  icon: LogIn,
                },
                {
                  label: "Total keluar",
                  value: `${totals.out_count.toLocaleString("id-ID")} Orang`,
                  icon: LogOut,
                },
                {
                  label: "Di dalam area",
                  value: `${Math.max(0, totals.in_count - totals.out_count).toLocaleString("id-ID")} Orang`,
                  icon: MapPinHouse,
                },
                {
                  label: "Laki-laki",
                  value: gender(totals.male_count),
                  icon: Mars,
                },
                {
                  label: "Perempuan",
                  value: gender(totals.female_count),
                  icon: Venus,
                },
                {
                  label: "Jam paling ramai",
                  value: peak?.label || "-",
                  icon: ClockArrowUp,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div className="stat-card" key={label}>
                  <Icon />
                  <div>
                    <p>{label}</p>
                    <strong>{value}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <h2>Distribusi Pengunjung</h2>
                  <p className="page-description">
                    Akumulasi per jam pada tanggal masing-masing event.
                  </p>
                </div>
                <button
                  className="btn icon-btn"
                  aria-label="Muat ulang rangkuman"
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              <VisitorChart
                hours={data.hours}
                date={`${events.length} event terpilih`}
                table={false}
              />
            </>
          ))
        )}
      </div>
      <footer className="modal-footer">
        <button className="btn" onClick={onClose}>
          Kembali
        </button>
      </footer>
    </Modal>
  );
}
