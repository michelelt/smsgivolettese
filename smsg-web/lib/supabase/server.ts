import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { roleFromClaims } from "@/lib/auth/roles";
import { supabaseEnv } from "./env";

export async function createClient() {
  const store = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          // Server Component: proxy.ts already refreshed the session.
        }
      },
    },
  });
}

export async function getSessionRole() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { claims: data?.claims ?? null, role: roleFromClaims(data?.claims) };
}
