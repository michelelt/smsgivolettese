import type { MetadataRoute } from "next";
import { parseEnv } from "@/lib/env";
import { getGallery } from "@/lib/public/server";

const PAGES = [
  "",
  "/servizi",
  "/notizie",
  "/galleria",
  "/proponi",
  "/chi-siamo",
  "/convenzioni",
  "/dove-siamo",
  "/privacy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = parseEnv(process.env).SITE_URL;
  const { items } = await getGallery(1, 24).catch(() => ({ items: [] }));
  // shortcut: only posts with a cover (gallery list), first 24; upgrade: list endpoint for all posts.
  return [
    ...PAGES.map((p) => ({ url: `${base}${p}` })),
    ...items.map((i) => ({ url: `${base}/notizie/${i.slug}` })),
  ];
}
