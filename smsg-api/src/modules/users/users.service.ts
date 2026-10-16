import type { z } from '@hono/zod-openapi';
import { env } from '../../config/env.js';
import type { Ctx } from '../../lib/ctx.js';
import { db } from '../../lib/db.js';
import { Conflict } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';
import { supabaseAdmin } from '../../lib/supabase-admin.js';
import type { InviteBody } from './users.schemas.js';

/** permissions.md: invite by email, then profile + role + volunteer row in one tx; the auth user is removed if the DB fails. */
export async function invite(ctx: Ctx, input: z.infer<typeof InviteBody>) {
  const admin = supabaseAdmin();
  const email = input.email.trim().toLowerCase();
  // GoTrue re-invites unconfirmed users without an error: refuse here, before touching auth
  const taken = await db.asService(
    (tx) => tx`select 1 from public.profiles where lower(email) = ${email}`,
    ctx.requestId,
  );
  if (taken.length) throw new Conflict('Esiste già un utente con questa email', 'USER_EXISTS');
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${env.WEB_URL ?? 'http://localhost:3000'}/imposta-password`,
  });
  if (error || !data.user) {
    if (error?.code === 'email_exists')
      throw new Conflict('Esiste già un utente con questa email', 'USER_EXISTS');
    log('error', 'invite failed', { status: error?.status });
    throw new Error('Invite failed');
  }
  const id = data.user.id;
  try {
    // service mode: user_roles is writable only by super_admin; audit rows carry the request id
    await db.asService(
      async (tx) => {
        await tx`insert into public.profiles (id, first_name, last_name, email)
               values (${id}, ${input.firstName}, ${input.lastName}, ${email})`;
        await tx`insert into public.user_roles (user_id, role) values (${id}, 'volontario')`;
        await tx`insert into public.volunteers (id) values (${id})`;
      },
      ctx.requestId,
      { id: ctx.user.id, role: ctx.user.role ?? '' },
    );
  } catch (e) {
    await admin.auth.admin.deleteUser(id);
    throw e;
  }
  return { id };
}
