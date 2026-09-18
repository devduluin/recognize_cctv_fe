"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Mail, UserRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAlert, AuthField, AuthShell, AuthSubmit } from "@/components/auth/auth-ui";

export default function RegisterPage() {
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const router = useRouter();
  const handleRegister = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try { const base = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth`; const response = await fetch(`${base}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full_name: fullName, email, password }) }); const data = await response.json(); if (!response.ok || !data.result?.token) throw new Error(data.message || data.detail || "Gagal mendaftar."); localStorage.setItem("auth_token", data.result.token); localStorage.setItem("user_info", JSON.stringify(data.result.user)); router.push("/onboarding"); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Gagal terhubung ke server."); } finally { setLoading(false); }
  };
  return <AuthShell eyebrow="Mulai perjalanan Anda" title="Buat workspace baru" subtitle="Siapkan akun untuk mengelola monitoring absensi dan pengunjung." footer={<>Sudah punya akun? <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Masuk di sini</Link></>}><form className="space-y-5" onSubmit={handleRegister}>{error && <AuthAlert><span>{error}</span></AuthAlert>}<AuthField label="Nama lengkap" icon={<UserRound size={18} />} required autoComplete="name" placeholder="Budi Santoso" value={fullName} onChange={(event) => setFullName(event.target.value)} /><AuthField label="Email" icon={<Mail size={18} />} type="email" required autoComplete="email" placeholder="nama@perusahaan.com" value={email} onChange={(event) => setEmail(event.target.value)} /><AuthField label="Password" icon={<LockKeyhole size={18} />} type="password" required minLength={8} autoComplete="new-password" placeholder="Minimal 8 karakter" value={password} onChange={(event) => setPassword(event.target.value)} /><AuthSubmit loading={loading}>{loading ? <Loader2 size={19} className="animate-spin" /> : "Lanjutkan"}</AuthSubmit></form></AuthShell>;
}
