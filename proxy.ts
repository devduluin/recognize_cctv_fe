import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  if (process.env.DESKTOP_MODE !== "true") return NextResponse.next();
  const actual = request.headers.get("x-desktop-window-token") || "";
  const expected = process.env.DESKTOP_WINDOW_TOKEN || "";
  const origin = request.headers.get("origin");
  const validToken = expected.length >= 32 && Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  const validHost = ["127.0.0.1", "localhost"].includes(request.nextUrl.hostname);
  const validOrigin = !origin || origin === process.env.DESKTOP_FRONTEND_ORIGIN;
  if (!validToken || !validHost || !validOrigin) {
    return NextResponse.json({ detail: "Local application access denied." }, { status: 403 });
  }
  return NextResponse.next();
}
