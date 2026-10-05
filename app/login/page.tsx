"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAlert, AuthField, AuthShell, AuthSubmit, authLinkClass } from "@/components/auth/auth-ui";
import { getAuthToken, postAuth, saveAuthSession, type AuthSession } from "@/components/auth/auth-api";
import { clearDashboardProfileCache } from "@/components/dashboard-profile";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const token = getAuthToken();
      if (!token) {
        setReady(true);
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        const user = JSON.parse(localStorage.getItem("user_info") || "null");
        if (typeof payload.exp !== "number" || payload.exp <= Date.now() / 1000 || !user?.id) {
          throw new Error("Session expired or incomplete");
        }
        router.replace(user.account_type ? "/" : "/onboarding");
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_info");
        clearDashboardProfileCache();
        setReady(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    if (loading || !ready) return;
    setError("");
    setLoading(true);
    try {
      const session = await postAuth<AuthSession>("login", { email: email.trim(), password });
      saveAuthSession(session);
      router.replace(session.user.account_type ? "/" : "/onboarding");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return <div role="status" className="grid min-h-dvh place-items-center text-sm text-muted">Memeriksa sesi…</div>;
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
