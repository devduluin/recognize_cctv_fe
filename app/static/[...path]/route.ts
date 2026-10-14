import { proxyBackend } from "../../../components/desktop/service-proxy";
export const dynamic = "force-dynamic";
async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyBackend(request, `/static/${path.map(encodeURIComponent).join("/")}`);
}
export { handler as GET, handler as HEAD };
