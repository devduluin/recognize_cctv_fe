import { redirect } from "next/navigation";

export default async function CCTVSettingsRedirect({ searchParams }: {
  searchParams: Promise<{ companyId?: string | string[] }>;
}) {
  const { companyId } = await searchParams;
  const value = Array.isArray(companyId) ? companyId[0] : companyId;
  const query = new URLSearchParams({ tab: "cctv" });
  if (value) query.set("companyId", value);
  redirect(`/settings?${query.toString()}`);
}
