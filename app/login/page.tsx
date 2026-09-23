"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAlert, AuthField, AuthShell, AuthSubmit, authLinkClass } from "@/components/auth/auth-ui";
import { postAuth, saveAuthSession, type AuthSession } from "@/components/auth/auth-api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const session = await postAuth<AuthSession>("login", { email: email.trim(), password });
      saveAuthSession(session);
      router.push(session.user.account_type ? "/" : "/onboarding");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Akses workspace" title="Selamat datang kembali" subtitle="Masuk untuk memantau kamera dan aktivitas pengunjung Anda." footer={<>Belum punya akun? <Link href="/register" className={authLinkClass}>Buat akun</Link></>}>
      <form onSubmit={handleLogin} className="space-y-5" aria-busy={loading}>
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthField label="Email" icon={<Mail size={18} />} type="email" name="email" required autoComplete="email" placeholder="nama@perusahaan.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
        <div>
          <AuthField label="Password" icon={<LockKeyhole size={18} />} type="password" name="password" required autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
          <div className="mt-1 flex justify-end"><Link href="/forgot-password" className={`${authLinkClass} inline-flex min-h-11 items-center text-xs`}>Lupa password?</Link></div>
        </div>
        <AuthSubmit loading={loading} loadingLabel="Sedang masuk…">Masuk ke dashboard</AuthSubmit>
      </form>
    </AuthShell>
  );
}
