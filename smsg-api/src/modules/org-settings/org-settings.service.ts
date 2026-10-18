import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { romeYear } from '../../lib/dates.js';
import * as repo from './org-settings.repo.js';
import type { CountersInput, OrgSettingsInput } from './org-settings.schemas.js';

export const get = (ctx: Ctx) => asUser(ctx, (tx) => repo.get(tx, romeYear()));

export const update = (ctx: Ctx, input: z.infer<typeof OrgSettingsInput>) =>
  asUser(ctx, async (tx) => {
    await repo.update(tx, input);
    return repo.get(tx, romeYear());
  });

export const setCounters = (ctx: Ctx, input: CountersInput) =>
  asUser(ctx, async (tx) => {
    await repo.setCounters(tx, input);
    return repo.get(tx, romeYear());
  });
