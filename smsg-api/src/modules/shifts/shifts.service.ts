import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { Conflict, NotFound, Unprocessable, ValidationError } from '../../lib/errors.js';
import { dispatch, shiftItem, volunteerMail, type Mail } from '../notifications/notify.js';
import { candidates } from './candidates.js';
import * as repo from './shifts.repo.js';
import type {
  CopyWeek,
  ShiftCreate,
  ShiftPatch,
  ShiftsQuery,
  ShiftTypeCreate,
  ShiftTypePatch,
} from './shifts.schemas.js';

const nothing = (o: object) => Object.values(o).every((v) => v === undefined);

// ---- shift types
export const types = async (ctx: Ctx) => ({ items: await asUser(ctx, repo.types) });
export const createType = (ctx: Ctx, input: z.infer<typeof ShiftTypeCreate>) =>
  asUser(ctx, (tx) => repo.createType(tx, input));
export const updateType = async (ctx: Ctx, id: string, input: z.infer<typeof ShiftTypePatch>) => {
  if (nothing(input)) throw new ValidationError('Nessuna modifica');
  const t = await asUser(ctx, (tx) => repo.updateType(tx, id, input));
  if (!t) throw new NotFound('Tipo di turno non trovato');
  return t;
};

// ---- shifts
export const list = async (ctx: Ctx, q: ShiftsQuery) => ({
  items: await asUser(ctx, (tx) => repo.range(tx, q.from, q.to)),
});

export const get = async (ctx: Ctx, id: string) => {
  const s = await asUser(ctx, (tx) => repo.byId(tx, id));
  if (!s) throw new NotFound('Turno non trovato');
  return s;
};

export const create = (ctx: Ctx, input: z.infer<typeof ShiftCreate>) =>
  asUser(ctx, async (tx) => {
    const id = await repo.insert(tx, {
      ...input,
      notes: input.notes ?? null,
      createdBy: ctx.user.id,
    });
    return (await repo.byId(tx, id))!;
  });

export async function update(ctx: Ctx, id: string, input: z.infer<typeof ShiftPatch>) {
  if (nothing(input)) throw new ValidationError('Nessuna modifica');
  const mails: Mail[] = [];
  const s = await asUser(ctx, async (tx) => {
    const before = await repo.byId(tx, id);
    if (!before) throw new NotFound('Turno non trovato');
    await repo.patch(tx, id, input);
    const after = (await repo.byId(tx, id))!;
    if (
      before.day + before.startTime + before.endTime !==
      after.day + after.startTime + after.endTime
    ) {
      const item = (await shiftItem(tx, id))!;
      for (const v of await repo.liveVolunteers(tx, id))
        mails.push(...(await volunteerMail(tx, v, 'modified', item)));
    }
    return after;
  });
  await dispatch(mails);
  return s;
}

export async function remove(ctx: Ctx, id: string) {
  const mails: Mail[] = [];
  await asUser(ctx, async (tx) => {
    const item = await shiftItem(tx, id);
    if (!item) throw new NotFound('Turno non trovato');
    for (const v of await repo.liveVolunteers(tx, id))
      mails.push(...(await volunteerMail(tx, v, 'cancelled', item)));
    await repo.remove(tx, id);
  });
  await dispatch(mails);
}

/** ADR-053: both weeks start on a Monday; assignments are never copied. */
export const copyWeek = (ctx: Ctx, b: z.infer<typeof CopyWeek>) =>
  asUser(ctx, async (tx) => {
    const days = Math.round((Date.parse(b.toWeek) - Date.parse(b.fromWeek)) / 86_400_000);
    const r = await repo.copyWeek(tx, b.fromWeek, b.toWeek, days, ctx.user.id);
    return { created: r.created, skipped: r.total - r.created };
  });

// ---- assignments
export async function assign(ctx: Ctx, shiftId: string, volunteerId: string) {
  const mails: Mail[] = [];
  const a = await asUser(ctx, async (tx) => {
    const item = await shiftItem(tx, shiftId);
    if (!item) throw new NotFound('Turno non trovato');
    const v = await repo.volunteerState(tx, volunteerId);
    if (!v) throw new NotFound('Volontario non trovato');
    if (!v.active) throw new Unprocessable('Il volontario non è attivo', 'VOLUNTEER_INACTIVE');
    if (await repo.isAbsent(tx, volunteerId, shiftId))
      throw new Conflict('Il volontario risulta assente in quel giorno', 'VOLUNTEER_ABSENT');
    const id = await repo.assign(tx, shiftId, volunteerId, ctx.user.id);
    if (!id) throw new Conflict('Il volontario è già assegnato a questo turno', 'ALREADY_ASSIGNED');
    mails.push(...(await volunteerMail(tx, volunteerId, 'assigned', item)));
    return (await repo.assignmentById(tx, id))!;
  });
  await dispatch(mails);
  return a;
}

export async function unassign(ctx: Ctx, shiftId: string, assignmentId: string) {
  const mails: Mail[] = [];
  await asUser(ctx, async (tx) => {
    const r = await repo.unassign(tx, shiftId, assignmentId);
    if (!r) throw new NotFound('Assegnazione non trovata');
    const item = await shiftItem(tx, shiftId);
    if (r.live && item) mails.push(...(await volunteerMail(tx, r.volunteerId, 'cancelled', item)));
  });
  await dispatch(mails);
}

export const shiftCandidates = (ctx: Ctx, shiftId: string) =>
  asUser(ctx, async (tx) => {
    const t = await repo.times(tx, shiftId);
    if (!t) throw new NotFound('Turno non trovato');
    return { items: await candidates(tx, { start: t.start, end: t.end, ownShiftId: shiftId }) };
  });
