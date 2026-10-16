import createClient, { type Middleware } from "openapi-fetch";
import { createClient as createSupabase } from "@/lib/supabase/client";
import type { paths } from "./schema";

// Browser-side: same-origin `/api` is rewritten to the API (next.config.ts).
export const api = createClient<paths>({ baseUrl: "/api" });

// Supabase JS is used for the session only; the token goes to the API as Bearer.
let supabase: ReturnType<typeof createSupabase> | undefined;
const bearer: Middleware = {
  async onRequest({ request }) {
    supabase ??= createSupabase();
    const { data } = await supabase.auth.getSession();
    if (data.session)
      request.headers.set(
        "Authorization",
        `Bearer ${data.session.access_token}`,
      );
    return request;
  },
};
api.use(bearer);
