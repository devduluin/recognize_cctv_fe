import { clearDashboardProfileCache } from "../dashboard-profile";

export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  account_type?: string | null;
  company_id?: string | null;
};
export type AuthSession = { token: string; user: AuthUser };

export async function postAuth<T>(path: string, body: object, token?: string): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) throw new Error("Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.");
    throw new Error(typeof data?.detail === "string" ? data.detail : typeof data?.message === "string" ? data.message : "Permintaan belum dapat diproses. Silakan coba lagi.");
  }
  if (!data?.result) throw new Error("Respons server tidak lengkap. Silakan coba lagi.");
  return data.result;
}

export function saveAuthSession(session: AuthSession) {
  if (!session.token || !session.user?.id) throw new Error("Respons akun tidak lengkap. Silakan coba lagi.");
  clearDashboardProfileCache();
  localStorage.setItem("auth_token", session.token);
  localStorage.setItem("user_info", JSON.stringify(session.user));
}
