import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { NotFound, ValidationError } from '../../lib/errors.js';
import { revalidate } from '../../lib/revalidate.js';
import * as repo from './services.repo.js';
import type { ServiceCreate, ServicePatch } from './services.schemas.js';

export const list = (ctx: Ctx) => asUser(ctx, repo.list);

export const create = async (ctx: Ctx, input: z.infer<typeof ServiceCreate>) => {
  const s = await asUser(ctx, (tx) => repo.create(tx, input));
  await revalidate(['services']);
  return s;
};

export const update = async (ctx: Ctx, id: string, input: z.infer<typeof ServicePatch>) => {
  if (Object.values(input).every((v) => v === undefined))
    throw new ValidationError('Nessuna modifica');
  const s = await asUser(ctx, (tx) => repo.update(tx, id, input));
  if (!s) throw new NotFound('Servizio non trovato');
  await revalidate(['services']);
  return s;
};
