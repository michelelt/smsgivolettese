import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam } from '../../lib/http.js';
import * as service from './clients.service.js';
import {
  Client,
  ClientCreate,
  ClientDetail,
  ClientPage,
  ClientPatch,
  ClientsQuery,
} from './clients.schemas.js';

const sec = [{ bearerAuth: [] }];
const ok = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  content: { 'application/json': { schema } },
  required: true as const,
});
const base = { tags: ['clients'], security: sec };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/clients',
  middleware: [requirePermission('clients.read')] as const,
  request: { query: ClientsQuery },
  responses: { 200: ok(ClientPage, 'Clienti'), ...errs() },
});
const get = createRoute({
  ...base,
  method: 'get',
  path: '/clients/{id}',
  middleware: [requirePermission('clients.read')] as const,
  request: { params: IdParam },
  responses: { 200: ok(ClientDetail, 'Scheda cliente'), ...errs(404) },
});
const create = createRoute({
  ...base,
  method: 'post',
  path: '/clients',
  middleware: [requirePermission('clients.write')] as const,
  request: { body: body(ClientCreate) },
  responses: { 201: ok(Client, 'Cliente creato'), ...errs(409, 422) },
});
const patch = createRoute({
  ...base,
  method: 'patch',
  path: '/clients/{id}',
  middleware: [requirePermission('clients.write')] as const,
  request: { params: IdParam, body: body(ClientPatch) },
  responses: { 200: ok(Client, 'Cliente aggiornato'), ...errs(404, 409, 422) },
});

export const clientsRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c), c.req.valid('param').id), 200))
  .openapi(create, async (c) => c.json(await service.create(ctxOf(c), c.req.valid('json')), 201))
  .openapi(patch, async (c) =>
    c.json(await service.update(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  );
