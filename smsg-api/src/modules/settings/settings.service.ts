import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { revalidate } from '../../lib/revalidate.js';
import * as repo from './settings.repo.js';
import type { SiteSettingsInput } from './settings.schemas.js';

export const putSiteSettings = async (ctx: Ctx, input: z.infer<typeof SiteSettingsInput>) => {
  const out = await asUser(ctx, (tx) => repo.putSiteSettings(tx, input));
  await revalidate(['site-settings']);
  return out;
};

export const getOrgInfo = (ctx: Ctx) => asUser(ctx, repo.orgInfo);
