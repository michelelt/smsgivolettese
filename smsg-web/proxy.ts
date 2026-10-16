import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess, roleFromClaims } from "@/lib/auth/roles";
import { supabaseEnv } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims(); // verifies and refreshes
  const role = roleFromClaims(data?.claims);
  const { pathname } = request.nextUrl;

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

export const config = { matcher: ["/gestione/:path*"] };
