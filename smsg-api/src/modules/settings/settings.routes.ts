import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs } from '../../lib/http.js';
import * as service from './settings.service.js';
import { OrgInfo, SiteSettings, SiteSettingsInput } from './settings.schemas.js';

const sec = [{ bearerAuth: [] }];
const put = createRoute({
  method: 'put',
  path: '/site-settings',
  tags: ['settings'],
  security: sec,
  middleware: [requirePermission('site_settings.write')] as const,
  request: {
    body: { content: { 'application/json': { schema: SiteSettingsInput } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SiteSettings } },
      description: 'Impostazioni salvate',
    },
    ...errs(),
  },
});
const org = createRoute({
  method: 'get',
  path: '/org-info',
  tags: ['settings'],
  security: sec,
  middleware: [requirePermission('org_info.read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: OrgInfo } },
      description: "Dati dell'ente per moduli e PDF",
    },
    ...errs(),
  },
});

export const settingsRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(put, async (c) =>
    c.json(await service.putSiteSettings(ctxOf(c), c.req.valid('json')), 200),
  )
  .openapi(org, async (c) => c.json(await service.getOrgInfo(ctxOf(c)), 200));
