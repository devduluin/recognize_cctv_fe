"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
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
  const logoPreview = (src: string) =>
    src ? (
      <Image
        unoptimized
        src={src}
        alt="Logo dashboard"
        width={112}
        height={112}
        className="h-28 w-28 object-contain"
      />
    ) : (
      <span
        className="dashboard-initial"
        role="img"
        aria-label="Inisial dashboard"
      >
        {(editing ? name : brand.name).trim().charAt(0).toUpperCase() || "D"}
      </span>
    );
  return (
    <>
      {notice && (
        <p role="status" className="mb-4 text-emerald-800">
          {notice}
        </p>
      )}
      {!editing && error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <section className="panel profile-panel">
        <div className="panel-heading">
          <div>
            <h2>Profil {dashboard ? "Dashboard" : "Pengguna"}</h2>
            <p className="panel-description">
              {dashboard
                ? "Informasi profil dashboard Anda"
                : "Informasi akun yang sedang aktif"}
            </p>
          </div>
          <button className="btn btn-outline" onClick={edit} disabled={!user || !loaded}>
            Edit
          </button>
        </div>
        {!loaded ? <p role="status">{error ? "Pengaturan belum tersedia. Muat ulang halaman untuk mencoba lagi." : "Memuat profil…"}</p> : dashboard ? (
          <>
            <div className="info-row">
              <span>Nama Dashboard</span>
              <span>{brand.name}</span>
            </div>
            <div className="info-row">
              <span>Logo Dashboard</span>
              {logoPreview(brand.logo)}
            </div>
            <p className="panel-description mt-4">
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
              <div className="info-row" key={label}>
                <span>{label}</span>
                <span>{value || "-"}</span>
              </div>
            ))}
          </>
        ) : (
          <p role="status">Memuat profil…</p>
        )}
      </section>
      {editing && (
        <Modal
          title={`Edit Profil ${dashboard ? "Dashboard" : "Pengguna"}`}
          onClose={() => setEditing(false)}
          busy={busy}
          size="small"
        >
          <form onSubmit={save}>
            <div className="modal-body space-y-4">
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
              <label className="field">
                Nama {dashboard ? "Dashboard" : "Pengguna"}
                <input
                  className="input"
                  autoFocus
                  required
                  maxLength={255}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {dashboard ? (
                <div className="field">
                  <span>Logo Dashboard</span>
                  <div className="flex flex-wrap items-center gap-4">
                    {logoPreview(logo)}
                    <label className="btn btn-outline cursor-pointer">
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
                <label className="field">
                  Email
                  <input
                    className="input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
            </div>
            <footer className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !name.trim()}
              >
                {busy ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
