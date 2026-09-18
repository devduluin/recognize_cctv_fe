import HourlyVisitorStatistics from "../components/hourly-visitor-statistics";

export default function Home() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Workspace Overview</p>
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-500">Pusat kontrol monitoring pengunjung dan absensi CCTV.</p>

      <HourlyVisitorStatistics />

    </main>
  );
}
