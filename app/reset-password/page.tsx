"use client";
import { FormEvent, useState } from "react";
import { Suspense } from "react";
import { LockKeyhole, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthAlert, AuthField, AuthShell, AuthSubmit } from "@/components/auth/auth-ui";

function ResetPasswordForm() {
  const params = useSearchParams(); const router = useRouter(); const token = params.get("token") || ""; const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password !== confirmation) { setError("Konfirmasi password tidak sama."); return; } setLoading(true); setError(""); try { const base = `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth`; const response = await fetch(`${base}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.detail || data.message || "Reset password gagal."); router.push("/login?reset=success"); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Gagal terhubung ke server."); } finally { setLoading(false); } };
  return <AuthShell eyebrow="Pemulihan akun" title="Buat password baru" subtitle="Gunakan password yang kuat dan mudah Anda ingat untuk mengamankan akun." footer={<>Kembali ke <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">halaman login</Link></>}><form className="space-y-5" onSubmit={submit}>{error && <AuthAlert>{error}</AuthAlert>}<AuthField label="Password baru" icon={<LockKeyhole size={18} />} type="password" required minLength={8} autoComplete="new-password" placeholder="Minimal 8 karakter" value={password} onChange={(event) => setPassword(event.target.value)} /><AuthField label="Konfirmasi password" icon={<LockKeyhole size={18} />} type="password" required minLength={8} autoComplete="new-password" placeholder="Ulangi password baru" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><AuthSubmit loading={loading}>{loading ? <Loader2 size={19} className="animate-spin" /> : "Simpan Password Baru"}</AuthSubmit></form></AuthShell>;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell eyebrow="Pemulihan akun" title="Memuat halaman" subtitle="Menyiapkan formulir reset password." />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
