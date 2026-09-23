export type DashboardProfile = { name: string; logo: string };
export const defaultDashboardProfile: DashboardProfile = {
  name: "CCTV Jannata",
  logo: "",
};

export async function dashboardProfileRequest(profile?: DashboardProfile, signal?: AbortSignal): Promise<DashboardProfile> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth/dashboard-profile`,
    {
      method: profile ? "PUT" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
      },
      body: profile ? JSON.stringify(profile) : undefined,
      cache: "no-store",
      signal,
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.result?.profile)
    throw new Error(typeof payload?.detail === "string" ? payload.detail : "Pengaturan dashboard tidak dapat dimuat atau disimpan. Coba lagi.");
  return payload.result.profile;
}
