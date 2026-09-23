import type { Metadata } from "next";
import "./globals.css";
import AdminShell from "../components/admin-shell";

export const metadata: Metadata = {
  title: "CCTV Jannata",
  description: "Dashboard monitoring pengunjung dan absensi CCTV.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full"><AdminShell>{children}</AdminShell></body>
    </html>
  );
}
