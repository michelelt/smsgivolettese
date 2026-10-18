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

const dev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(":", "") as "http" | "https",
            hostname: supabase.hostname,
            port: supabase.port,
            pathname: "/storage/v1/object/public/media/**",
          },
        ]
      : [],
    // Local Supabase resolves to a loopback address, blocked by default.
    ...(dev ? { dangerouslyAllowLocalIP: true } : {}),
  },
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
