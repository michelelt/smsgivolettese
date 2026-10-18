import { asUser, type Ctx } from '../../lib/ctx.js';
import { db } from '../../lib/db.js';
import { romeToday } from '../../lib/dates.js';
import { NotFound, ValidationError } from '../../lib/errors.js';
import { dispatch, shiftItem, staffRefusalMails } from '../notifications/notify.js';
import type { Item } from '../notifications/templates.js';
import * as vrepo from '../volunteers/volunteers.repo.js';
import { strip } from '../volunteers/volunteers.service.js';
import type { AvailabilityRule } from '../volunteers/volunteers.schemas.js';
import * as repo from './me.repo.js';

const uid = (ctx: Ctx) => ctx.user.id;

export const profile = async (ctx: Ctx) => {
  const n = await asUser(ctx, (tx) => repo.name(tx, uid(ctx)));
  return { firstName: n?.firstName ?? null, lastName: n?.lastName ?? null };
};

export const availability = async (ctx: Ctx) => ({
  rules: await asUser(ctx, (tx) => repo.rules(tx, uid(ctx))),
});

/** True when two rules of the same weekday overlap. */
export const overlapping = (rules: AvailabilityRule[]) =>
  rules.some((a, i) =>
    rules.some(
      (b, j) =>
        i < j && a.weekday === b.weekday && a.startTime < b.endTime && b.startTime < a.endTime,
    ),
  );

export const putAvailability = (ctx: Ctx, rules: AvailabilityRule[]) => {
  if (overlapping(rules))
    throw new ValidationError('Gli orari di uno stesso giorno si sovrappongono');
  return asUser(ctx, async (tx) => {
    await repo.replaceRules(tx, uid(ctx), rules);
    return { rules: await repo.rules(tx, uid(ctx)) };
  });
};

export const absences = (ctx: Ctx) =>
  asUser(ctx, async (tx) => ({
    items: (await vrepo.absencesFor(tx, [uid(ctx)])).map(strip),
  }));

export const addAbsence = (
  ctx: Ctx,
  a: { startsOn: string; endsOn: string; note?: string | null },
) => {
  if (a.endsOn < romeToday()) throw new ValidationError('La data di fine non può essere passata');
  return asUser(ctx, async (tx) => ({
    id: await repo.addAbsence(tx, uid(ctx), { ...a, note: a.note ?? null }),
    conflictingCommitments: await repo.countCommitments(tx, uid(ctx), a.startsOn, a.endsOn),
  }));
};

export const deleteAbsence = (ctx: Ctx, id: string) =>
  asUser(ctx, async (tx) => {
    if ((await repo.deleteAbsence(tx, uid(ctx), id)).length === 0)
      throw new NotFound('Assenza non trovata');
  });

export const commitments = (ctx: Ctx) =>
  asUser(ctx, async (tx) => ({
    shifts: await repo.shifts(tx, uid(ctx)),
    transports: await repo.transports(tx),
  }));

/** Refusals email active staff (read with the service role: volunteers cannot read other profiles). */
const notifyRefusal = async (ctx: Ctx, item: Item | undefined) => {
  if (!item) return;
  await dispatch(await db.asService((tx) => staffRefusalMails(tx, uid(ctx), item), ctx.requestId));
};

export async function respondShift(ctx: Ctx, id: string, accept: boolean) {
  const item = await asUser(ctx, async (tx) => {
    const shiftId = await repo.myShiftId(tx, uid(ctx), id);
    const it = shiftId ? await shiftItem(tx, shiftId) : undefined;
    await repo.respondShift(tx, id, accept);
    return it;
  });
  if (!accept) await notifyRefusal(ctx, item);
}

export async function respondTransport(ctx: Ctx, id: string, accept: boolean) {
  const item = await asUser(ctx, async (tx) => {
    const it = await repo.myTransportItem(tx, id); // before: a refusal removes it from the view
    await repo.respondTransport(tx, id, accept);
    return it;
  });
  if (!accept) await notifyRefusal(ctx, item);
}

export const completeTransport = (
  ctx: Ctx,
  id: string,
  o: { odometerStart: number; odometerEnd: number; driverNotes?: string | null },
) =>
  asUser(ctx, (tx) =>
    repo.completeTransport(tx, id, o.odometerStart, o.odometerEnd, o.driverNotes ?? null),
  ).then(() => undefined);
