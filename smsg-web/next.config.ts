import type { NextConfig } from "next";
import { publicCsp } from "./lib/csp";
import { parseEnv } from "./lib/env";

const { API_URL } = parseEnv(process.env);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private routes get a nonce CSP from proxy.ts (ADR-036).
      {
        source: "/:path((?!gestione|accedi|imposta-password).*)",
        headers: [{ key: "Content-Security-Policy", value: publicCsp() }],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
