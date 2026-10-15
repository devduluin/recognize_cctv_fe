export const dynamic = "force-dynamic";
export function GET() {
  if (process.env.DESKTOP_MODE !== "true") return new Response(null, { status: 404 });
  return Response.json({ ok: true, service: "visitor-frontend", desktop: true });
}
