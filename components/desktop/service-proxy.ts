export async function proxyBackend(request: Request, pathname: string) {
  const desktop = process.env.DESKTOP_MODE === "true";
  const base = desktop ? process.env.DESKTOP_BACKEND_ORIGIN : process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV;
  if (!base) return Response.json({ detail: "Backend is not configured." }, { status: 503 });
  const target = new URL(base);
  if (desktop && (target.protocol !== "http:" || target.hostname !== "127.0.0.1")) return Response.json({ detail: "Invalid local backend configuration." }, { status: 503 });
  target.pathname = pathname;
  target.search = new URL(request.url).search;
  const headers = new Headers(request.headers);
  for (const name of ["host", "connection", "transfer-encoding", "content-length", "x-desktop-window-token", "x-desktop-service-token"]) headers.delete(name);
  if (desktop) headers.set("X-Desktop-Service-Token", process.env.DESKTOP_SERVICE_TOKEN || "");
  try {
    const init: RequestInit & { duplex?: "half" } = { method: request.method, headers, cache: "no-store", signal: request.signal, redirect: "manual" };
    if (!["GET", "HEAD"].includes(request.method)) { init.body = request.body; init.duplex = "half"; }
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers(upstream.headers);
    for (const name of ["connection", "transfer-encoding", "content-encoding", "content-length"]) responseHeaders.delete(name);
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ detail: "Local backend is unavailable." }, { status: 502 });
  }
}
