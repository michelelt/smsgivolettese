import type { MetadataRoute } from "next";
import { parseEnv } from "@/lib/env";

const PAGES = [
  "",
  "/servizi",
  "/prenota",
  "/chi-siamo",
  "/contatti",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = parseEnv(process.env).SITE_URL;
  return PAGES.map((p) => ({ url: `${base}${p}` }));
}
