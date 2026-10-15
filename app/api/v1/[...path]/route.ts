import { proxyBackend } from "../../../../components/desktop/service-proxy";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyBackend(request, `/api/v1/${path.map(encodeURIComponent).join("/")}`);
}
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as HEAD, handler as OPTIONS };
