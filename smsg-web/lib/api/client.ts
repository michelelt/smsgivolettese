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
// ADR-063: an aal1 super admin gets 403 MFA_REQUIRED on super-admin actions.
const mfaRequired: Middleware = {
  async onResponse({ response }) {
    if (
      response.status === 403 &&
      typeof window !== "undefined" &&
      !location.pathname.startsWith("/gestione/account/sicurezza") &&
      (
        await response
          .clone()
          .json()
          .catch(() => null)
      )?.error?.code === "MFA_REQUIRED"
    )
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload keeps the session fresh
      location.assign(
        `/gestione/account/sicurezza?next=${encodeURIComponent(location.pathname)}`,
      );
    return undefined;
  },
};
api.use(bearer, mfaRequired);
