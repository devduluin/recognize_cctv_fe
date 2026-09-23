"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Building2, Phone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { AccountChoice, AuthAlert, AuthField, AuthShell, AuthSubmit, authLinkClass } from "@/components/auth/auth-ui";
import { postAuth, type AuthUser } from "@/components/auth/auth-api";
import { clearDashboardProfileCache } from "@/components/dashboard-profile";

export default function OnboardingPage() {
  const [accountType, setAccountType] = useState("personal");
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (!localStorage.getItem("auth_token")) {
          router.replace("/login");
          return;
        }
        const user = JSON.parse(localStorage.getItem("user_info") || "null");
        if (user?.account_type) router.replace("/");
        else setReady(true);
      } catch {
        router.replace("/login");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  async function handleSetup(event: FormEvent) {
    event.preventDefault();
    if (loading || !ready) return;
    setError("");
    if (accountType === "company" && !companyName.trim()) {
      setError("Masukkan nama perusahaan Anda.");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const result = await postAuth<{ user: AuthUser }>("setup-account", {
        account_type: accountType,
        company_name: accountType === "company" ? companyName.trim() : undefined,
        company_phone: accountType === "company" ? companyPhone.trim() : undefined,
      }, token);
      if (!result.user?.id) throw new Error("Respons akun tidak lengkap. Silakan coba lagi.");
      clearDashboardProfileCache();
      localStorage.setItem("user_info", JSON.stringify(result.user));
      router.push("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  function switchAccount() {
    clearDashboardProfileCache();
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    router.replace("/login");
  }

  return (
    <AuthShell step={2} eyebrow="Pengaturan awal" title="Workspace untuk Anda" subtitle="Pilih jenis akun yang sesuai dengan kebutuhan operasional Anda." footer={<button type="button" onClick={switchAccount} disabled={loading} className={`${authLinkClass} min-h-11`}>Gunakan akun lain</button>}>
      {!ready ? <p role="status" className="py-6 text-sm text-muted">Menyiapkan workspace…</p> : (
        <form className="space-y-6" onSubmit={handleSetup} aria-busy={loading}>
          {error && <AuthAlert>{error}</AuthAlert>}
          <fieldset disabled={loading} className="space-y-3">
            <legend className="mb-3 text-sm font-medium text-foreground">Jenis akun</legend>
            <AccountChoice value="personal" label="Personal" description="Kelola kamera dan event untuk kebutuhan Anda sendiri." icon={UserRound} checked={accountType === "personal"} onChange={() => setAccountType("personal")} disabled={loading} />
            <AccountChoice value="company" label="Perusahaan" description="Gunakan workspace untuk operasional perusahaan." icon={Building2} checked={accountType === "company"} onChange={() => setAccountType("company")} disabled={loading} />
          </fieldset>
          {accountType === "company" ? (
            <div className="space-y-5 border-t border-line pt-6">
              <AuthField label="Nama perusahaan" icon={<Building2 size={18} />} name="company_name" required maxLength={255} autoComplete="organization" placeholder="Nama perusahaan Anda" value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={loading} />
              <AuthField label="Nomor telepon (opsional)" icon={<Phone size={18} />} type="tel" name="company_phone" autoComplete="tel" placeholder="Nomor telepon perusahaan" value={companyPhone} onChange={(event) => setCompanyPhone(event.target.value)} disabled={loading} />
            </div>
          ) : <p className="rounded-lg bg-[#f3f5f9] px-4 py-3 text-sm leading-6 text-[#52647f]">Tidak perlu data perusahaan. Anda bisa langsung melanjutkan ke dashboard.</p>}
          <AuthSubmit loading={loading} loadingLabel="Menyiapkan workspace…">Buka workspace saya</AuthSubmit>
        </form>
      )}
    </AuthShell>
  );
}
