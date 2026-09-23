export type DashboardProfile = { name: string; logo: string };
export const defaultDashboardProfile: DashboardProfile = {
  name: "Computer Vision",
  logo: "",
};

type ProfileCache = {
  key: string;
  value?: DashboardProfile;
  expiresAt: number;
  pending?: Promise<DashboardProfile>;
};
let cache: ProfileCache | undefined;
const CACHE_TTL_MS = 60_000;

export function clearDashboardProfileCache() {
  cache = undefined;
}

function cacheKey(token: string) {
  const user = JSON.parse(localStorage.getItem("user_info") || "null");
  return `${token}:${user?.company_id || user?.id || ""}`;
}

async function fetchProfile(
  token: string,
  profile?: DashboardProfile,
  signal?: AbortSignal,
): Promise<DashboardProfile> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth/dashboard-profile`,
    {
      method: profile ? "PUT" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: profile ? JSON.stringify(profile) : undefined,
      cache: "no-store",
      signal,
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.result?.profile)
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : "Pengaturan dashboard tidak dapat dimuat atau disimpan. Coba lagi.",
    );
  return payload.result.profile;
}

export async function dashboardProfileRequest(
  profile?: DashboardProfile,
  signal?: AbortSignal,
): Promise<DashboardProfile> {
  signal?.throwIfAborted();
  const token = localStorage.getItem("auth_token") || "";
  const key = cacheKey(token);
  if (!cache || cache.key !== key || profile) cache = { key, expiresAt: 0 };
  const entry = cache;

  if (entry.value && entry.expiresAt > Date.now()) {
    const value = await Promise.resolve(entry.value);
    signal?.throwIfAborted();
    return value;
  }
  if (!entry.pending) {
    // Each consumer can unmount without cancelling the shared network request.
    entry.pending = fetchProfile(token, profile, profile ? signal : undefined)
      .then((value) => {
        if (cache === entry) {
          entry.value = value;
          entry.expiresAt = Date.now() + CACHE_TTL_MS;
        }
        return value;
      })
      .finally(() => {
        entry.pending = undefined;
      });
  }
  const result = await entry.pending;
  signal?.throwIfAborted();
  return result;
}
