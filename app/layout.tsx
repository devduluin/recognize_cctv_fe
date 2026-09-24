import type { Metadata } from "next";
import "./globals.css";
import AdminShell from "../components/admin-shell";

export const metadata: Metadata = {
  title: "Computer Vision",
  description: "Dashboard monitoring pengunjung CCTV.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
