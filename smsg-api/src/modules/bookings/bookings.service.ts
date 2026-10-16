import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { Conflict, DomainError, NotFound, Unprocessable } from '../../lib/errors.js';
import type { Tx } from '../../lib/db.js';
import * as repo from './bookings.repo.js';
import type { BookingCreate, BookingsQuery } from './bookings.schemas.js';

export const list = (ctx: Ctx, q: BookingsQuery) => asUser(ctx, (tx) => repo.list(tx, q));
export const kpis = (ctx: Ctx) => asUser(ctx, repo.kpis);

/** ADR-046/047: origin telefono; status by time; price snapshot by declared/actual membership. */
export const create = (ctx: Ctx, input: z.infer<typeof BookingCreate>) =>
  asUser(ctx, async (tx) => {
    const svc = await repo.serviceById(tx, input.serviceId);
    if (!svc) throw new NotFound('Servizio non trovato');
    if (!svc.active) throw new Unprocessable('Il servizio non è attivo', 'SERVICE_INACTIVE');
    const cli = await repo.clientMembership(tx, input.clientId);
    if (!cli) throw new DomainError(404, 'CLIENT_NOT_FOUND', 'Cliente non trovato');
    const declaredMember = input.declaredMember ?? cli.isActiveMember;
    const id = await repo.insert(tx, {
      ...input,
      time: input.time ?? null,
      notes: input.notes ?? null,
      declaredMember,
      priceCents: declaredMember ? svc.memberPriceCents : svc.nonMemberPriceCents,
      createdBy: ctx.user.id,
    });
    return (await repo.byId(tx, id))!;
  });

async function move(ctx: Ctx, id: string, run: (tx: Tx) => Promise<unknown[]>) {
  return asUser(ctx, async (tx) => {
    if ((await run(tx)).length === 0) {
      if (!(await repo.exists(tx, id))) throw new NotFound('Prenotazione non trovata');
      throw new Conflict(
        'Operazione non consentita nello stato attuale',
        'BOOKING_INVALID_TRANSITION',
      );
    }
    return (await repo.byId(tx, id))!;
  });
}

export const confirm = (ctx: Ctx, id: string, time?: string) =>
  move(ctx, id, (tx) => repo.confirm(tx, id, time ?? null));
export const execute = (ctx: Ctx, id: string) => move(ctx, id, (tx) => repo.execute(tx, id));
export const cancel = (ctx: Ctx, id: string, by: 'staff' | 'utente') =>
  move(ctx, id, (tx) => repo.cancel(tx, id, by));
export const restore = (ctx: Ctx, id: string) => move(ctx, id, (tx) => repo.restore(tx, id));
