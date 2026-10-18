import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam, jsonBody, ok } from '../../lib/http.js';
import * as service from './vehicles.service.js';
import { Vehicle, VehicleCreate, VehiclePatch, VehiclesResponse } from './vehicles.schemas.js';

const base = { tags: ['vehicles'], security: [{ bearerAuth: [] }] };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/vehicles',
  middleware: [requirePermission('vehicles.read')] as const,
  responses: { 200: ok(VehiclesResponse, 'Mezzi'), ...errs() },
});
const create = createRoute({
  ...base,
  method: 'post',
  path: '/vehicles',
  middleware: [requirePermission('vehicles.write')] as const,
  request: { body: jsonBody(VehicleCreate) },
  responses: { 201: ok(Vehicle, 'Mezzo creato'), ...errs(409) },
});
const patch = createRoute({
  ...base,
  method: 'patch',
  path: '/vehicles/{id}',
  middleware: [requirePermission('vehicles.write')] as const,
  request: { params: IdParam, body: jsonBody(VehiclePatch) },
  responses: { 200: ok(Vehicle, 'Mezzo aggiornato'), ...errs(404, 409) },
});

export const vehiclesRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c)), 200))
  .openapi(create, async (c) => c.json(await service.create(ctxOf(c), c.req.valid('json')), 201))
  .openapi(patch, async (c) =>
    c.json(await service.update(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  );
