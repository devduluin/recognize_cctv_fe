"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAccess } from "../../components/auth/access";
import { visitorFetch } from "../../components/auth/visitor-fetch";
import type { AuthUser } from "../../components/auth/auth-api";
import { Button } from "../../components/ui/button";
import { Field, Input, Select } from "../../components/ui/field";
import { Page, PageHeading, Panel } from "../../components/ui/layout";
import { ui } from "../../components/ui/styles";

type Role = "admin" | "operator" | "viewer";
type ManagedUser = AuthUser & { version: string; role: Role; is_active: boolean };
type Catalog = { permissions: { key: string; label: string }[]; roles: Record<Role, string[]> };
type Draft = { full_name: string; email: string; password: string; role: Role; custom: boolean; permissions: string[]; is_active: boolean };
const empty = (): Draft => ({ full_name: "", email: "", password: "", role: "viewer", custom: false, permissions: [], is_active: true });
const roleLabels: Record<Role, string> = { admin: "Admin", operator: "Operator", viewer: "Viewer" };

async function api<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await visitorFetch(`${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/users${path}`, {
    method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload?.detail === "string" ? payload.detail : typeof payload?.message === "string" ? payload.message : "Pengelolaan pengguna belum dapat diproses.");
  return payload.result;
}

export default function UsersPage() {
  const { user: current, can, loading: accessLoading, error: accessError, refresh } = useAccess();
  const allowed = can("users.manage");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ user: ManagedUser | null } | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const limit = 25;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, permissions] = await Promise.all([
        api<{ users: ManagedUser[]; total: number }>(`?limit=${limit}&offset=${offset}`),
        api<Catalog>("/permissions"),
      ]);
      setUsers(list.users); setTotal(list.total); setCatalog(permissions);
    } finally { setLoading(false); }
  }, [offset]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const timer = setTimeout(() => void load().catch(cause => { if (active) setError(cause.message); }), 0);
    return () => { active = false; clearTimeout(timer); };
  }, [allowed, load]);

  function edit(user: ManagedUser | null) {
    setEditor({ user }); setError(""); setNotice("");
    setDraft(user ? { full_name: user.full_name || "", email: user.email, password: "", role: user.role,
      custom: user.custom_permissions != null, permissions: user.custom_permissions ?? user.permissions ?? [], is_active: user.is_active } : empty());
  }
  function changeRole(role: Role) {
    setDraft(value => ({ ...value, role, custom: false, permissions: catalog?.roles[role] || [] }));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true); setError("");
    const target = editor.user;
    const body = { full_name: draft.full_name, email: draft.email, role: draft.role,
      permissions: draft.role !== "admin" && draft.custom ? draft.permissions : null,
      ...(draft.password ? { password: draft.password } : {}),
      ...(target ? { expected_version: target.version, is_active: draft.is_active } : {}) };
    try {
      await api(target ? `/${target.id}` : "", target ? "PATCH" : "POST", body);
      setEditor(null); setDraft(empty());
      setNotice(target ? "Pengguna berhasil diperbarui." : "Pengguna berhasil ditambahkan.");
      await refresh(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pengguna belum dapat disimpan."); }
    finally { setBusy(false); }
  }
  if (accessLoading) return <Page><p role="status">Memuat hak akses…</p></Page>;
  if (!allowed) return <Page><h1>Pengguna</h1><p role="alert">{accessError || "Anda tidak memiliki izin untuk mengelola pengguna workspace ini."}</p></Page>;
  const selected = draft.custom ? draft.permissions : catalog?.roles[draft.role] || [];
  return <Page>
    <PageHeading>
      <div>
        <h1>{editor ? editor.user ? "Ubah pengguna" : "Tambah pengguna" : "Pengguna"}</h1>
        <p className={ui.pageDescription}>{editor ? "Kelola identitas dan hak akses pengguna ini." : "Tambahkan anggota workspace dan atur tindakan yang dapat mereka lakukan."}</p>
      </div>
      {!editor && <Button variant="primary" disabled={busy || !catalog} onClick={() => edit(null)}>Tambah pengguna</Button>}
    </PageHeading>
    {error && <p role="alert" className={ui.error}>{error}</p>}
    {notice && <p role="status" className="mb-4 text-emerald-800">{notice}</p>}
    {editor && <Panel className="mb-5" aria-labelledby="user-editor-title">
      <h2 id="user-editor-title">Identitas dan hak akses</h2>
      <form onSubmit={save} className="mt-4 space-y-5">
        <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
          <legend className="sr-only">Identitas dan akses pengguna</legend>
          <Field>Nama lengkap<Input required maxLength={255} value={draft.full_name} onChange={event => setDraft({ ...draft, full_name: event.target.value })} /></Field>
          <Field>Email<Input type="email" autoComplete="off" required maxLength={255} value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></Field>
          <Field>{editor.user ? "Password baru (kosongkan jika tetap)" : "Password awal"}
            <Input type="password" autoComplete="new-password" required={!editor.user} minLength={10} maxLength={128} value={draft.password} onChange={event => setDraft({ ...draft, password: event.target.value })} />
          </Field>
          <Field>Peran<Select value={draft.role} onChange={event => changeRole(event.target.value as Role)}>
            {(Object.keys(roleLabels) as Role[]).map(role => <option key={role} value={role} disabled={role === "admin" && current?.role !== "admin"}>{roleLabels[role]}</option>)}
          </Select></Field>
          {editor.user && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} />Akun aktif</label>}
        </fieldset>
        <fieldset disabled={busy} className="space-y-3">
          <legend className="font-semibold">Izin pengguna</legend>
          {draft.role === "admin" ? <p className="text-sm text-muted">Admin memiliki seluruh izin. Setidaknya satu Admin aktif harus tetap tersedia.</p> : <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.custom} onChange={event => setDraft({ ...draft, custom: event.target.checked, permissions: [...selected] })} />Sesuaikan izin per fitur
          </label>}
          <div className="grid gap-3 md:grid-cols-2">
            {catalog?.permissions.map(permission => <label key={permission.key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={selected.includes(permission.key)} disabled={draft.role === "admin" || !draft.custom || (current?.role !== "admin" && !can(permission.key))}
                onChange={event => setDraft({ ...draft, permissions: event.target.checked ? [...draft.permissions, permission.key] : draft.permissions.filter(key => key !== permission.key) })} />
              {permission.label}
            </label>)}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan pengguna"}</Button>
          <Button type="button" disabled={busy} onClick={() => { setEditor(null); setDraft(empty()); }}>Batal</Button>
        </div>
      </form>
    </Panel>}
    {!editor && <>
    <div className={ui.tableWrap} aria-busy={loading}>
      <table className={ui.table}>
        <caption className="sr-only">Daftar pengguna workspace</caption>
        <thead><tr><th scope="col">Nama</th><th scope="col">Email</th><th scope="col">Peran</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead>
        <tbody>{users.map(user => <tr key={user.id}>
          <td>{user.full_name}{user.id === current?.id && <span className="ml-2 text-muted">(Anda)</span>}</td><td>{user.email}</td>
          <td>{roleLabels[user.role]}{user.custom_permissions != null && user.role !== "admin" ? " · Izin khusus" : ""}</td>
          <td>{user.is_active ? "Aktif" : "Nonaktif"}</td>
          <td><Button disabled={busy || (user.role === "admin" && current?.role !== "admin")} onClick={() => edit(user)}>Ubah</Button></td>
        </tr>)}</tbody>
      </table>
      {!loading && users.length === 0 && <p className="p-5" role="status">Belum ada pengguna pada halaman ini.</p>}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>Sebelumnya</Button>
      <span className="text-sm">{total === 0 ? 0 : offset + 1}–{Math.min(offset + limit, total)} dari {total} pengguna</span>
      <Button disabled={offset + limit >= total || loading} onClick={() => setOffset(offset + limit)}>Berikutnya</Button>
      <Button disabled={loading} onClick={() => void load().catch(cause => setError(cause.message))}>Muat ulang</Button>
    </div>
    </>}
  </Page>;
}
