import type { Metadata } from "next";
import "./globals.css";
import AdminShell from "../components/admin-shell";

export const metadata: Metadata = {
  title: "Vision Admin",
  description: "Dashboard monitoring pengunjung dan absensi CCTV.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 text-slate-900"><AdminShell>{children}</AdminShell></body>
    </html>
  );
}
