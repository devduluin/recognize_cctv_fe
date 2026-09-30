import type { Metadata } from "next";
import "./globals.css";
import AdminShell from "../components/admin-shell";
import MaintenancePage from "../components/maintenance-page";

export const metadata: Metadata = {
  title: "Computer Vision",
  description: "Dashboard monitoring pengunjung CCTV.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  const isMaintenance =
    process.env.IS_MAINTANANCE === "true" ||
    process.env.IS_MAINTENANCE === "true" ||
    process.env.NEXT_PUBLIC_IS_MAINTANANCE === "true" ||
    process.env.NEXT_PUBLIC_IS_MAINTENANCE === "true";

  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">
        {isMaintenance ? <MaintenancePage /> : <AdminShell>{children}</AdminShell>}
      </body>
    </html>
  );
}
