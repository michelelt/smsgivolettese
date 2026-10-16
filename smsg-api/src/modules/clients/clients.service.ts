import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { DomainError, ValidationError } from '../../lib/errors.js';
import { assertTaxCode } from '../../lib/tax-code.js';
import * as repo from './clients.repo.js';
import type { ClientCreate, ClientPatch, ClientsQuery } from './clients.schemas.js';

export const list = (ctx: Ctx, q: z.infer<typeof ClientsQuery>) =>
  asUser(ctx, (tx) => repo.list(tx, q));

export const get = async (ctx: Ctx, id: string) => {
  const c = await asUser(ctx, (tx) => repo.detail(tx, id));
  if (!c) throw new DomainError(404, 'CLIENT_NOT_FOUND', 'Cliente non trovato');
  return c;
};

/** Normalises the tax code (ADR-048) and drops the confirmation flag; '' clears it. */
function row<T extends z.infer<typeof ClientPatch>>({ taxCodeConfirmed, ...rest }: T) {
  const taxCode = rest.taxCode
    ? assertTaxCode(rest.taxCode, taxCodeConfirmed)
    : rest.taxCode === ''
      ? null
      : rest.taxCode;
  return { ...rest, taxCode };
}

export const create = (ctx: Ctx, input: z.infer<typeof ClientCreate>) =>
  asUser(ctx, async (tx) => (await repo.byId(tx, await repo.insert(tx, row(input))))!);

export const update = (ctx: Ctx, id: string, input: z.infer<typeof ClientPatch>) => {
  const r = row(input);
  if (Object.values(r).every((v) => v === undefined)) throw new ValidationError('Nessuna modifica');
  return asUser(ctx, async (tx) => {
    if ((await repo.update(tx, id, r)).length === 0)
      throw new DomainError(404, 'CLIENT_NOT_FOUND', 'Cliente non trovato');
    return (await repo.byId(tx, id))!;
  });
};
