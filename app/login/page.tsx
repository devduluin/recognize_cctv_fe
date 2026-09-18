"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Mail, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAlert, AuthField, AuthShell, AuthSubmit } from "@/components/auth/auth-ui";

export default function LoginPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const router = useRouter();
  const handleLogin = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try { const base = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth`; const response = await fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) }); const raw = await response.text(); let data: any = {}; try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; } if (!response.ok || !data.result?.token) throw new Error(data.message || data.detail || (response.status === 404 ? "Email belum terdaftar. Silakan daftar terlebih dahulu." : "Email atau password salah.")); localStorage.setItem("auth_token", data.result.token); localStorage.setItem("user_info", JSON.stringify(data.result.user)); router.push("/"); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Gagal terhubung ke server."); } finally { setLoading(false); }
  };
  return <AuthShell eyebrow="Selamat datang kembali" title="Masuk ke workspace Anda" subtitle="Pantau operasional dan sistem komputer visi dari satu dashboard." footer={<>Belum punya akun? <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">Daftar sekarang</Link></>}><form className="space-y-5" onSubmit={handleLogin}>{error && <AuthAlert><span>{error}</span></AuthAlert>}<AuthField label="Email" icon={<Mail size={18} />} type="email" required autoComplete="email" placeholder="nama@perusahaan.com" value={email} onChange={(event) => setEmail(event.target.value)} /><div><AuthField label="Password" icon={<LockKeyhole size={18} />} type="password" required autoComplete="current-password" placeholder="Masukkan password Anda" value={password} onChange={(event) => setPassword(event.target.value)} /><Link href="/forgot-password" className="mt-2 block text-right text-xs font-semibold text-indigo-600 hover:text-indigo-700">Lupa password?</Link></div><AuthSubmit loading={loading}>{loading ? <Loader2 size={19} className="animate-spin" /> : "Masuk ke Dashboard"}</AuthSubmit></form></AuthShell>;
}
