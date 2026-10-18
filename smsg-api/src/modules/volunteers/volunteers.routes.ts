import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam, jsonBody, ok } from '../../lib/http.js';
import * as service from './volunteers.service.js';
import {
  AvailabilityOverview,
  VolunteerDetail,
  VolunteerPage,
  VolunteerPatch,
  VolunteersQuery,
} from './volunteers.schemas.js';

const base = { tags: ['volunteers'], security: [{ bearerAuth: [] }] };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/volunteers',
  middleware: [requirePermission('volunteers.read')] as const,
  request: { query: VolunteersQuery },
  responses: { 200: ok(VolunteerPage, 'Volontari'), ...errs() },
});
const get = createRoute({
  ...base,
  method: 'get',
  path: '/volunteers/{id}',
  middleware: [requirePermission('volunteers.read')] as const,
  request: { params: IdParam },
  responses: { 200: ok(VolunteerDetail, 'Volontario'), ...errs(404) },
});
const patch = createRoute({
  ...base,
  method: 'patch',
  path: '/volunteers/{id}',
  middleware: [requirePermission('volunteers.write')] as const,
  request: { params: IdParam, body: jsonBody(VolunteerPatch) },
  responses: { 200: ok(VolunteerDetail, 'Volontario aggiornato'), ...errs(404, 409) },
});
const availability = createRoute({
  ...base,
  method: 'get',
  path: '/availability',
  middleware: [requirePermission('availability.read_all')] as const,
  responses: { 200: ok(AvailabilityOverview, 'Disponibilità dei volontari'), ...errs() },
});

export const volunteersRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c), c.req.valid('param').id), 200))
  .openapi(patch, async (c) =>
    c.json(await service.update(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .openapi(availability, async (c) => c.json(await service.overview(ctxOf(c)), 200));
