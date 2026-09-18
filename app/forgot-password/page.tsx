"use client";
import { FormEvent, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import Link from "next/link";
import { AuthAlert, AuthField, AuthShell, AuthSubmit } from "@/components/auth/auth-ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setMessage(""); setError(""); try { const base = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth`; const response = await fetch(`${base}/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const data = await response.json(); if (!response.ok) throw new Error(data.detail || data.message || "Permintaan reset gagal."); setMessage(data.message || "Jika email terdaftar, link reset password telah dikirim."); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Gagal terhubung ke server."); } finally { setLoading(false); } };
  return <AuthShell eyebrow="Pemulihan akun" title="Lupa password?" subtitle="Masukkan email akun Anda. Kami akan mengirimkan link untuk membuat password baru." footer={<>Ingat password Anda? <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Kembali ke login</Link></>}><form className="space-y-5" onSubmit={submit}>{message && <AuthAlert tone="success">{message}</AuthAlert>}{error && <AuthAlert>{error}</AuthAlert>}<AuthField label="Email akun" icon={<Mail size={18} />} type="email" required autoComplete="email" placeholder="nama@perusahaan.com" value={email} onChange={(event) => setEmail(event.target.value)} /><AuthSubmit loading={loading}>{loading ? <Loader2 size={19} className="animate-spin" /> : "Kirim Link Reset"}</AuthSubmit></form></AuthShell>;
}
