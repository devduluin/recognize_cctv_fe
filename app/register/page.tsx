"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAlert, AuthField, AuthShell, AuthSubmit, authLinkClass } from "@/components/auth/auth-ui";
import { postAuth, saveAuthSession, type AuthSession } from "@/components/auth/auth-api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (!fullName.trim()) {
      setError("Masukkan nama lengkap Anda.");
      return;
    }
    setLoading(true);
    try {
      const session = await postAuth<AuthSession>("register", { full_name: fullName.trim(), email: email.trim(), password });
      saveAuthSession(session);
      router.push(session.user.account_type ? "/" : "/onboarding");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell step={1} eyebrow="Daftar akun" title="Mulai dari akun Anda" subtitle="Buat akun, lalu pilih workspace personal atau perusahaan." footer={<>Sudah punya akun? <Link href="/login" className={authLinkClass}>Masuk</Link></>}>
      <form className="space-y-5" onSubmit={handleRegister} aria-busy={loading}>
        {error && <AuthAlert>{error}</AuthAlert>}
        <AuthField label="Nama lengkap" icon={<UserRound size={18} />} name="full_name" required maxLength={255} autoComplete="name" placeholder="Nama lengkap Anda" value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={loading} />
        <AuthField label="Email" icon={<Mail size={18} />} type="email" name="email" required autoComplete="email" placeholder="nama@perusahaan.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
        <AuthField label="Password" icon={<LockKeyhole size={18} />} type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="Buat password" hint="Gunakan minimal 8 karakter." value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
        <AuthSubmit loading={loading} loadingLabel="Membuat akun…">Buat akun & lanjutkan</AuthSubmit>
      </form>
    </AuthShell>
  );
}
