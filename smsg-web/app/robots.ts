import type { MetadataRoute } from "next";
import { parseEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/gestione",
        "/accedi",
        "/imposta-password",
        "/api/",
        "/auth/",
        "/hooks/",
      ],
    },
    sitemap: `${parseEnv(process.env).SITE_URL}/sitemap.xml`,
  };
}
