import createClient from "openapi-fetch";
import type { paths } from "@/lib/api/schema";
import { parseEnv } from "@/lib/env";

const client = createClient<paths>({ baseUrl: parseEnv(process.env).API_URL });
const cache = (tag: string) => ({ next: { tags: [tag], revalidate: 3600 } });

const building = () => process.env.NEXT_PHASE === "phase-production-build";
const EMPTY_SETTINGS = {
  address: null,
  slogan: null,
  homeIntro: null,
  vatNumber: null,
  conventions: [],
  footerLinks: [],
  // Build-only fallback while the API is down; pages revalidate within the hour.
  pages: {
    home: {
      servicesButton: "I nostri servizi",
      whereButton: "Dove siamo",
      quote: "",
      quoteSource: "",
    },
    chiSiamo: { title: "Chi siamo", intro: "", sections: [] },
    privacy: { title: "Informativa sulla privacy", intro: "", sections: [] },
    servizi: { title: "I nostri servizi", intro: "" },
    convenzioni: { title: "Convenzioni", intro: "" },
    doveSiamo: { title: "Dove siamo", intro: "" },
  },
};

// Throw at runtime so ISR keeps serving the last good page instead of caching a broken one;
// only the build falls back, so a deploy never fails because the API is down.
// shortcut: a fallback page built here stays up to `revalidate` (1h) since it is per-page, not per-fetch; upgrade: revalidatePath("/") after deploy.
async function load<T>(
  path: string,
  fn: () => Promise<T | undefined>,
  fallback: T,
): Promise<T> {
  try {
    const data = await fn();
    if (data) return data;
  } catch (e) {
    if (!building()) throw e;
    return fallback;
  }
  if (building()) return fallback;
  throw new Error(`GET ${path} failed`);
}

export const getServices = () =>
  load(
    "/public/services",
    async () =>
      (await client.GET("/public/services", cache("services"))).data?.items,
    [],
  );

export const getSiteSettings = () =>
  load(
    "/public/site-settings",
    async () =>
      (await client.GET("/public/site-settings", cache("site-settings"))).data,
    EMPTY_SETTINGS,
  );
