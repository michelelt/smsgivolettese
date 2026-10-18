import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam } from '../../lib/http.js';
import * as service from './services.service.js';
import { ServiceCreate, ServicePatch, ServicesResponse, StaffService } from './services.schemas.js';

const sec = [{ bearerAuth: [] }];
const json = <T extends object>(schema: T) => ({ 'application/json': { schema } }) as never;

const list = createRoute({
  method: 'get',
  path: '/services',
  tags: ['services'],
  security: sec,
  middleware: [requirePermission('services.read')] as const,
  responses: {
    200: { content: json(ServicesResponse), description: 'Tutti i servizi, con prezzi' },
    ...errs(),
  },
});
const create = createRoute({
  method: 'post',
  path: '/services',
  tags: ['services'],
  security: sec,
  middleware: [requirePermission('services.write')] as const,
  request: { body: { content: { 'application/json': { schema: ServiceCreate } }, required: true } },
  responses: { 201: { content: json(StaffService), description: 'Servizio creato' }, ...errs() },
});
const patch = createRoute({
  method: 'patch',
  path: '/services/{id}',
  tags: ['services'],
  security: sec,
  middleware: [requirePermission('services.write')] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: ServicePatch } }, required: true },
  },
  responses: {
    200: { content: json(StaffService), description: 'Servizio aggiornato' },
    ...errs(404),
  },
});

export const servicesRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json({ items: await service.list(ctxOf(c)) }, 200))
  .openapi(create, async (c) => c.json(await service.create(ctxOf(c), c.req.valid('json')), 201))
  .openapi(patch, async (c) =>
    c.json(await service.update(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  );
