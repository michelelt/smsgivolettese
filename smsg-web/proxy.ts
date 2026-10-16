import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess, roleFromClaims } from "@/lib/auth/roles";
import { privateCsp } from "@/lib/csp";
import { parseEnv } from "@/lib/env";
import { supabaseEnv } from "@/lib/supabase/env";

// ADR-040: forward the real client IP to the API, trusted via a shared secret.
function rewritePublicApi(request: NextRequest) {
  const { API_URL, API_PROXY_SECRET } = parseEnv(process.env);
  const headers = new Headers(request.headers);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  headers.set("x-client-ip", ip);
  headers.set("x-proxy-secret", API_PROXY_SECRET);
  const { pathname, search } = request.nextUrl;
  return NextResponse.rewrite(
    new URL(pathname.replace(/^\/api/, "") + search, API_URL),
    { request: { headers } },
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/public/")) return rewritePublicApi(request);

  // ADR-036: Next reads the nonce from the request CSP header.
  const csp = privateCsp(btoa(crypto.randomUUID()));
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("content-security-policy", csp);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("content-security-policy", csp);
    return res;
  };
  let response = next();
  if (!pathname.startsWith("/gestione")) return response;

  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims(); // verifies and refreshes
  const role = roleFromClaims(data?.claims);

  if (!canAccess(role, pathname)) {
    const to = request.nextUrl.clone();
    if (role === null) {
      to.pathname = "/accedi";
      to.search = `?next=${encodeURIComponent(pathname)}`;
    } else {
      to.pathname = "/gestione";
      to.search = "?negato=1";
    }
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    "/gestione/:path*",
    "/accedi",
    "/imposta-password",
    "/api/public/:path*",
  ],
};
