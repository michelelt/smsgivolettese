import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { z } from "zod";
import { isRoleRefusal, safeNext } from "@/lib/auth/roles";
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
  let error:
    { message: string; status?: number; code?: string } | null | undefined;
  if (q.success) {
    if (q.data.code) {
      ({ error } = await supabase.auth.exchangeCodeForSession(q.data.code));
    } else if (q.data.token_hash && q.data.type) {
      ({ error } = await supabase.auth.verifyOtp({
        type: q.data.type as EmailOtpType,
        token_hash: q.data.token_hash,
      }));
    } else error = { message: "missing params" };
  } else error = { message: "invalid params" };
  if (error) {
    // The Access Token Hook rejects staff/super_admin sessions from links.
    // Other failures (expired, already used, invalid) get the generic link message.
    const staff = isRoleRefusal(error);
    return NextResponse.redirect(
      `${origin}/accedi?errore=${staff ? "personale" : "link"}`,
    );
  }
  // Invites and recovery must pick a password first.
  const needsPassword =
    q.data?.type === "invite" || q.data?.type === "recovery";
  const dest = needsPassword ? "/imposta-password" : safeNext(q.data?.next);
  return NextResponse.redirect(`${origin}${dest}`);
}
