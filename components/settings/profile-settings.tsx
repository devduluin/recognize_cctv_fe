"use client";
import { useEffect, useState, type FormEvent } from "react";
import { BrandLogo } from "../ui/brand-logo";
import { Button, buttonStyles } from "../ui/button";
import { Field, Input } from "../ui/field";
import { InfoRow, Panel } from "../ui/layout";
import { cx, ui } from "../ui/styles";
import Modal from "../ui-modal";
import { dashboardProfileRequest, defaultDashboardProfile } from "../dashboard-profile";
type User = {
  id: string;
  company_id?: string;
  full_name: string;
  email: string;
  account_type: string;
};
export default function ProfileSettings({
  kind,
}: {
  kind: "profile" | "dashboard";
}) {
  const [user, setUser] = useState<User | null>(null);
  const [brand, setBrand] = useState(defaultDashboardProfile);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dashboard = kind === "dashboard";
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => {
      try {
        const current = JSON.parse(localStorage.getItem("user_info") || "null");
        setUser(current);
        if (dashboard) {
          dashboardProfileRequest(undefined, controller.signal).then((profile) => {
            setBrand(profile);
            setLoaded(true);
          }).catch((error) => {
            if (!controller.signal.aborted) setError(error.message);
          });
        } else setLoaded(true);
      } catch {
        setError("Profil tidak dapat dimuat. Silakan masuk kembali.");
      }
    }, 0);
    return () => { clearTimeout(initial); controller.abort(); };
  }, [dashboard]);
  function edit() {
    setName(dashboard ? brand.name : user?.full_name || "");
    setEmail(user?.email || "");
    setLogo(brand.logo);
    setError("");
    setEditing(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (dashboard) {
        const profile = await dashboardProfileRequest({ name: name.trim(), logo });
        setBrand(profile);
        window.dispatchEvent(new CustomEvent("dashboard-profile-changed", { detail: profile }));
      } else {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth/profile`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
            },
            body: JSON.stringify({
              full_name: name.trim(),
              email: email.trim(),
            }),
          },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            typeof payload?.detail === "string"
              ? payload.detail
              : "Profil belum dapat disimpan. Coba lagi.",
          );
        if (!payload?.result?.user)
          throw new Error("Respons profil tidak valid.");
        setUser(payload.result.user);
        localStorage.setItem("user_info", JSON.stringify(payload.result.user));
      }
      window.dispatchEvent(new Event("profile-changed"));
      setEditing(false);
      setNotice("Perubahan berhasil disimpan.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Perubahan gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  const logoPreview = (src: string) => <BrandLogo name={editing ? name : brand.name} src={src} />;
  return (
    <>
      {notice && (
        <p role="status" className="mb-4 text-emerald-800">
          {notice}
        </p>
      )}
      {!editing && error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <Panel className="max-w-[740px]">
        <div className={ui.panelHeading}>
          <div>
            <h2>Profil {dashboard ? "Dashboard" : "Pengguna"}</h2>
            <p className={ui.panelDescription}>
              {dashboard
                ? "Informasi profil dashboard Anda"
                : "Informasi akun yang sedang aktif"}
            </p>
          </div>
          <Button variant="outline" onClick={edit} disabled={!user || !loaded}>
            Edit
          </Button>
        </div>
        {!loaded ? <p role="status">{error ? "Pengaturan belum tersedia. Muat ulang halaman untuk mencoba lagi." : "Memuat profil…"}</p> : dashboard ? (
          <>
            <InfoRow>
              <span>Nama Dashboard</span>
              <span>{brand.name}</span>
            </InfoRow>
            <InfoRow>
              <span>Logo Dashboard</span>
              {logoPreview(brand.logo)}
            </InfoRow>
            <p className={ui.panelDescription}>
              Nama dan logo digunakan untuk dashboard workspace ini.
            </p>
          </>
        ) : user ? (
          <>
            {[
              ["Nama", user.full_name],
              ["Email", user.email],
              ["Tipe Akun", user.account_type],
              ["Workspace ID", user.company_id || user.id],
            ].map(([label, value]) => (
              <InfoRow key={label}>
                <span>{label}</span>
                <span>{value || "-"}</span>
              </InfoRow>
            ))}
          </>
        ) : (
          <p role="status">Memuat profil…</p>
        )}
      </Panel>
      {editing && (
        <Modal
          title={`Edit Profil ${dashboard ? "Dashboard" : "Pengguna"}`}
          onClose={() => setEditing(false)}
          busy={busy}
          size="small"
        >
          <form onSubmit={save}>
            <div className={cx(ui.modalBody, "space-y-4")}>
              {error && (
                <p role="alert" className={ui.error}>
                  {error}
                </p>
              )}
              <Field>
                Nama {dashboard ? "Dashboard" : "Pengguna"}
                <Input
                  autoFocus
                  required
                  maxLength={255}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              {dashboard ? (
                <div className={ui.field}>
                  <span>Logo Dashboard</span>
                  <div className="flex flex-wrap items-center gap-4">
                    {logoPreview(logo)}
                    <label className={buttonStyles({ variant: "outline", className: "cursor-pointer" })}>
                      Ganti Logo
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (
                            file.size > 1024 * 1024 ||
                            !["image/png", "image/jpeg", "image/webp"].includes(
                              file.type,
                            )
                          ) {
                            setError(
                              "Pilih gambar PNG, JPEG, atau WebP maksimal 1 MB.",
                            );
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setLogo(String(reader.result));
                            setError("");
                          };
                          reader.onerror = () => setError("Gambar gagal dibaca. Pilih kembali file logo.");
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                  <small className="text-slate-500">
                    PNG, JPEG, atau WebP, maksimal 1 MB.
                  </small>
                </div>
              ) : (
                <Field>
                  Email
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              )}
            </div>
            <footer className={ui.modalFooter}>
              <Button
                type="button"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !name.trim()}
              >
                {busy ? "Menyimpan…" : "Simpan Perubahan"}
              </Button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
