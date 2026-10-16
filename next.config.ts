import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    if (process.env.DESKTOP_BUILD === "true") return [];
    const recognizeCctvBase = process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || "http://127.0.0.1:8000";
    return { beforeFiles: [
      {
        source: "/api/v1/cctv/:path*",
        destination: `${recognizeCctvBase}/api/v1/cctv/:path*`,
      },
      {
        source: "/api/v1/auth/:path*",
        destination: `${recognizeCctvBase}/api/v1/auth/:path*`,
      },
      {
        source: "/api/v1/events/:path*",
        destination: `${recognizeCctvBase}/api/v1/events/:path*`,
      },
      {
        source: "/api/v1/events",
        destination: `${recognizeCctvBase}/api/v1/events`,
      },
      {
        source: "/api/v1/event_visitor/:path*",
        destination: `${recognizeCctvBase}/api/v1/event_visitor/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${recognizeCctvBase}/static/:path*`,
      },
    ] };
  },
  output: "standalone",
  outputFileTracingIncludes: {
    "/manual-guide": ["./docs/manual/README.md", "./public/manual/screenshots/**/*"],
  },
};

export default nextConfig;
