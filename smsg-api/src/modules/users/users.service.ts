import type { z } from '@hono/zod-openapi';
import { can } from '../../auth/permissions.js';
import { env } from '../../config/env.js';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { db } from '../../lib/db.js';
import { BadGateway, Conflict, DomainError, Forbidden, mfaRequired } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';
import { supabaseAdmin } from '../../lib/supabase-admin.js';
import * as repo from './users.repo.js';
import type { InviteBody, UsersQuery } from './users.schemas.js';

/** permissions.md: invite by email, then profile + role + volunteer row in one tx; the auth user is removed if the DB fails. */
export async function invite(ctx: Ctx, input: z.infer<typeof InviteBody>) {
  if (input.role !== 'volontario' && !can(ctx.user.role, 'users.invite_staff')) {
    if (ctx.user.mfaPending) throw mfaRequired();
    throw new Forbidden();
  }
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
        await tx`insert into public.user_roles (user_id, role) values (${id}, ${input.role})`;
        if (input.role === 'volontario')
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

export const list = (ctx: Ctx, q: UsersQuery) => asUser(ctx, (tx) => repo.list(tx, q));

const invalidTransition = (m: string) => new Conflict(m, 'USER_INVALID_TRANSITION');
const notFound = () => new DomainError(404, 'USER_NOT_FOUND', 'Utente non trovato');
const lastSuperAdmin = () =>
  new Conflict("È l'unico super admin: nominane un altro prima", 'LAST_SUPER_ADMIN');

export const changeRole = (ctx: Ctx, id: string, role: 'volontario' | 'staff' | 'super_admin') =>
  asUser(ctx, async (tx) => {
    const cur = await repo.lockRole(tx, id);
    if (!cur) throw notFound();
    if (cur.anonymized) throw invalidTransition('L’utente è stato anonimizzato');
    if (cur.role !== role) {
      if (cur.role === 'super_admin' && cur.active && !cur.otherSuperAdmin) throw lastSuperAdmin();
      await repo.setRole(tx, id, role);
      if (role === 'volontario') await repo.upsertVolunteer(tx, id);
      else if (cur.role === 'volontario') await repo.deactivateVolunteer(tx, id); // may raise DRIVER_HAS_FUTURE_TRANSPORTS
    }
    return (await repo.get(tx, id))!;
  });

/** Same tx as the DB flip: an Auth failure throws and rolls the profile back (ADR-064). */
const setActive = (ctx: Ctx, id: string, active: boolean) =>
  asUser(ctx, async (tx) => {
    const cur = await repo.lockRole(tx, id);
    if (!cur) throw notFound();
    if (!active && cur.role === 'super_admin' && cur.active && !cur.otherSuperAdmin)
      throw lastSuperAdmin();
    if ((await repo.setActive(tx, id, active)) === 0)
      throw new Conflict(
        active ? "L'utente non può essere riattivato" : "L'utente è già disattivato",
        'USER_INVALID_TRANSITION',
      );
    if (!active) await repo.deactivateVolunteer(tx, id);
    const { error } = await supabaseAdmin().auth.admin.updateUserById(id, {
      ban_duration: active ? 'none' : '876000h',
    });
    if (error) {
      log('error', 'auth ban sync failed', { status: error.status });
      throw new BadGateway('Aggiornamento dell’accesso non riuscito, riprova', 'AUTH_SYNC_FAILED');
    }
    return (await repo.get(tx, id))!;
  });
export const deactivate = (ctx: Ctx, id: string) => setActive(ctx, id, false);
export const reactivate = (ctx: Ctx, id: string) => setActive(ctx, id, true);

/** Lost authenticator: removes every TOTP factor (ADR-063). */
export async function resetMfa(ctx: Ctx, id: string) {
  if (id === ctx.user.id)
    throw new Conflict('Non puoi azzerare la tua autenticazione a due fattori', 'SELF_FORBIDDEN');
  if (!(await asUser(ctx, (tx) => repo.get(tx, id)))) throw notFound();
  const mfa = supabaseAdmin().auth.admin.mfa;
  const { data, error } = await mfa.listFactors({ userId: id });
  if (error) throw new BadGateway('Operazione non riuscita, riprova', 'AUTH_SYNC_FAILED');
  for (const f of data.factors) {
    const r = await mfa.deleteFactor({ id: f.id, userId: id });
    if (r.error) throw new BadGateway('Operazione non riuscita, riprova', 'AUTH_SYNC_FAILED');
  }
  // service mode with the caller as actor (audit_log has no authenticated insert path)
  await db.asService(
    (tx) => repo.auditMfaReset(tx, id, data.factors.length, ctx.requestId),
    ctx.requestId,
    { id: ctx.user.id, role: ctx.user.role ?? '' },
  );
  return { removed: data.factors.length };
}
