import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export default async function DesktopValidationPage() {
  if (process.env.DESKTOP_VALIDATION !== "true") notFound();
  async function verifyAction() {
    "use server";
    if (process.env.DESKTOP_VALIDATION !== "true" || !process.env.APP_DATA_DIR) throw new Error("Validation is disabled.");
    await writeFile(path.join(process.env.APP_DATA_DIR, "server-action-smoke.txt"), "server-action-ok");
    (await cookies()).set("desktop-action-result", "server-action-ok", { httpOnly: true, sameSite: "strict" });
    redirect("/desktop-validation");
  }
  const result = (await cookies()).get("desktop-action-result")?.value;
  return <main><h1>Desktop runtime validation</h1><p id="ssr-marker">SSR:{randomUUID()}</p><p id="action-result">{result || "pending"}</p><form action={verifyAction}><button id="run-server-action" type="submit">Run server action</button></form></main>;
}
