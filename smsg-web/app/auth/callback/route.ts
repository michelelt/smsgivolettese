import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { z } from "zod";
import { safeNext } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const query = z.object({
  code: z.string().optional(),
  token_hash: z.string().optional(),
  type: z
    .enum([
      "invite",
      "magiclink",
      "recovery",
      "email",
      "signup",
      "email_change",
    ])
    .optional(),
  next: z.string().optional(),
});

// Handles PKCE `code` (magic link) and `token_hash` (invite/recovery templates).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const q = query.safeParse(Object.fromEntries(searchParams));
  const supabase = await createClient();
  let ok = false;
  if (q.success) {
    if (q.data.code) {
      ok = !(await supabase.auth.exchangeCodeForSession(q.data.code)).error;
    } else if (q.data.token_hash && q.data.type) {
      ok = !(
        await supabase.auth.verifyOtp({
          type: q.data.type as EmailOtpType,
          token_hash: q.data.token_hash,
        })
      ).error;
    }
  }
  if (!ok) return NextResponse.redirect(`${origin}/accedi?errore=link`);
  // Invites and recovery must pick a password first.
  const needsPassword =
    q.data?.type === "invite" || q.data?.type === "recovery";
  const dest = needsPassword ? "/imposta-password" : safeNext(q.data?.next);
  return NextResponse.redirect(`${origin}${dest}`);
}
