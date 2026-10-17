import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, jsonBody, ok } from '../../lib/http.js';
import { CountersInput, OrgSettings, OrgSettingsInput } from './org-settings.schemas.js';
import * as service from './org-settings.service.js';

const base = { tags: ['org-settings'], security: [{ bearerAuth: [] }] };

const get = createRoute({
  ...base,
  method: 'get',
  path: '/org-settings',
  middleware: [requirePermission('org_settings.write')] as const,
  responses: { 200: ok(OrgSettings, "Impostazioni dell'ente"), ...errs() },
});
const put = createRoute({
  ...base,
  method: 'put',
  path: '/org-settings',
  middleware: [requirePermission('org_settings.write')] as const,
  request: { body: jsonBody(OrgSettingsInput) },
  responses: { 200: ok(OrgSettings, 'Impostazioni salvate'), ...errs() },
});
const counters = createRoute({
  ...base,
  method: 'put',
  path: '/org-settings/counters',
  middleware: [requirePermission('counters.write')] as const,
  request: { body: jsonBody(CountersInput) },
  responses: { 200: ok(OrgSettings, 'Numerazioni aggiornate'), ...errs(409) },
});

export const orgSettingsRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c)), 200))
  .openapi(put, async (c) => c.json(await service.update(ctxOf(c), c.req.valid('json')), 200))
  .openapi(counters, async (c) =>
    c.json(await service.setCounters(ctxOf(c), c.req.valid('json')), 200),
  );
