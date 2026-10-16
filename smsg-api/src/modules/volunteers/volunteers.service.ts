import { asUser, type Ctx } from '../../lib/ctx.js';
import { NotFound, ValidationError } from '../../lib/errors.js';
import * as repo from './volunteers.repo.js';
import type { VolunteerPatch, VolunteersQuery } from './volunteers.schemas.js';
import type { z } from '@hono/zod-openapi';

export const strip = <T extends { volunteerId: string }>(r: T): Omit<T, 'volunteerId'> => {
  const c: Partial<T> = { ...r };
  delete c.volunteerId;
  return c as Omit<T, 'volunteerId'>;
};

export const list = (ctx: Ctx, q: VolunteersQuery) => asUser(ctx, (tx) => repo.list(tx, q));

export const get = (ctx: Ctx, id: string) =>
  asUser(ctx, async (tx) => {
    const v = await repo.byId(tx, id);
    if (!v) throw new NotFound('Volontario non trovato');
    const [rules, absences] = await Promise.all([
      repo.rulesFor(tx, [id]),
      repo.absencesFor(tx, [id]),
    ]);
    return { ...v, rules: rules.map(strip), absences: absences.map(strip) };
  });

export const update = (ctx: Ctx, id: string, input: z.infer<typeof VolunteerPatch>) =>
  asUser(ctx, async (tx) => {
    if (Object.values(input).every((v) => v === undefined))
      throw new ValidationError('Nessuna modifica');
    if (!(await repo.byId(tx, id))) throw new NotFound('Volontario non trovato');
    await repo.update(tx, id, input);
    const v = (await repo.byId(tx, id))!;
    const [rules, absences] = await Promise.all([
      repo.rulesFor(tx, [id]),
      repo.absencesFor(tx, [id]),
    ]);
    return { ...v, rules: rules.map(strip), absences: absences.map(strip) };
  });

/** Staff overview: active volunteers with their weekly rules and upcoming absences. */
export const overview = (ctx: Ctx) =>
  asUser(ctx, async (tx) => {
    // shortcut: first 100 active volunteers, plenty for this association; paginate if it grows.
    const vols = await repo.list(tx, { page: 1, pageSize: 100, active: true });
    const ids = vols.items.map((v) => v.id);
    const [rules, absences] = await Promise.all([
      repo.rulesFor(tx, ids),
      repo.absencesFor(tx, ids),
    ]);
    return {
      items: vols.items.map((v) => ({
        volunteerId: v.id,
        firstName: v.firstName,
        lastName: v.lastName,
        rules: rules.filter((r) => r.volunteerId === v.id).map(strip),
        absences: absences.filter((a) => a.volunteerId === v.id).map(strip),
      })),
    };
  });
