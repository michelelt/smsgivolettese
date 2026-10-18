import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { NotFound, ValidationError } from '../../lib/errors.js';
import * as repo from './vehicles.repo.js';
import type { VehicleCreate, VehiclePatch } from './vehicles.schemas.js';

export const list = async (ctx: Ctx) => ({ items: await asUser(ctx, repo.list) });
export const create = (ctx: Ctx, input: z.infer<typeof VehicleCreate>) =>
  asUser(ctx, (tx) => repo.create(tx, input));

export const update = async (ctx: Ctx, id: string, input: z.infer<typeof VehiclePatch>) => {
  if (Object.values(input).every((v) => v === undefined))
    throw new ValidationError('Nessuna modifica');
  const v = await asUser(ctx, (tx) => repo.update(tx, id, input));
  if (!v) throw new NotFound('Mezzo non trovato');
  return v;
};
