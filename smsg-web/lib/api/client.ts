import createClient from "openapi-fetch";
import type { paths } from "./schema";

// Browser-side: same-origin `/api` is rewritten to the API (next.config.ts).
export const api = createClient<paths>({ baseUrl: "/api" });
