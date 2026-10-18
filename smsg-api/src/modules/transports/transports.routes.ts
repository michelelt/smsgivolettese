import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import {
  attachment,
  ctxOf,
  defaultHook,
  errs,
  fileContent,
  IdParam,
  jsonBody,
  ok,
} from '../../lib/http.js';
import { CandidatesResponse } from '../shifts/shifts.schemas.js';
import * as service from './transports.service.js';
import {
  CsvQuery,
  Transport,
  TransportAssign,
  TransportComplete,
  TransportCreate,
  TransportPatch,
  TransportsQuery,
  TransportsResponse,
} from './transports.schemas.js';

const base = { tags: ['transports'], security: [{ bearerAuth: [] }] };
const verbRoute = {
  ...base,
  method: 'post' as const,
  responses: { 200: ok(Transport, 'Trasporto aggiornato'), ...errs(404, 409, 422) },
};

const list = createRoute({
  ...base,
  method: 'get',
  path: '/transports',
  middleware: [requirePermission('transports.read')] as const,
  request: { query: TransportsQuery },
  responses: { 200: ok(TransportsResponse, 'Trasporti'), ...errs() },
});
const csv = createRoute({
  ...base,
  method: 'get',
  path: '/transports/export.csv',
  middleware: [requirePermission('transports.export')] as const,
  request: { query: CsvQuery },
  responses: { 200: fileContent('text/csv'), ...errs() },
});
const create = createRoute({
  ...base,
  method: 'post',
  path: '/transports',
  middleware: [requirePermission('transports.write')] as const,
  request: { body: jsonBody(TransportCreate) },
  responses: { 201: ok(Transport, 'Trasporto creato'), ...errs(404) },
});
const get = createRoute({
  ...base,
  method: 'get',
  path: '/transports/{id}',
  middleware: [requirePermission('transports.read')] as const,
  request: { params: IdParam },
  responses: { 200: ok(Transport, 'Trasporto'), ...errs(404) },
});
const patch = createRoute({
  ...base,
  method: 'patch',
  path: '/transports/{id}',
  middleware: [requirePermission('transports.write')] as const,
  request: { params: IdParam, body: jsonBody(TransportPatch) },
  responses: { 200: ok(Transport, 'Trasporto aggiornato'), ...errs(404, 409) },
});
const sheet = createRoute({
  ...base,
  method: 'get',
  path: '/transports/{id}/sheet.pdf',
  middleware: [requirePermission('transports.read')] as const,
  request: { params: IdParam },
  responses: { 200: fileContent('application/pdf'), ...errs(404) },
});
const candidates = createRoute({
  ...base,
  method: 'get',
  path: '/transports/{id}/candidates',
  middleware: [requirePermission('transports.assign')] as const,
  request: { params: IdParam },
  responses: { 200: ok(CandidatesResponse, 'Autisti candidati'), ...errs(404, 422) },
});
const assign = createRoute({
  ...verbRoute,
  path: '/transports/{id}/assign',
  middleware: [requirePermission('transports.assign')] as const,
  request: { params: IdParam, body: jsonBody(TransportAssign) },
});
const unassign = createRoute({
  ...verbRoute,
  path: '/transports/{id}/unassign',
  middleware: [requirePermission('transports.assign')] as const,
  request: { params: IdParam },
});
const cancel = createRoute({
  ...verbRoute,
  path: '/transports/{id}/cancel',
  middleware: [requirePermission('transports.assign')] as const,
  request: { params: IdParam },
});
const complete = createRoute({
  ...verbRoute,
  path: '/transports/{id}/complete',
  middleware: [requirePermission('transports.assign')] as const,
  request: { params: IdParam, body: jsonBody(TransportComplete) },
});

export const transportsRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(csv, async (c) => {
    const f = await service.csv(ctxOf(c), c.req.valid('query').month);
    return attachment(f.body, 'text/csv; charset=utf-8', f.filename) as never;
  })
  .openapi(create, async (c) => c.json(await service.create(ctxOf(c), c.req.valid('json')), 201))
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c), c.req.valid('param').id), 200))
  .openapi(patch, async (c) =>
    c.json(await service.update(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .openapi(sheet, async (c) => {
    const f = await service.sheet(ctxOf(c), c.req.valid('param').id);
    return attachment(f.body, 'application/pdf', f.filename) as never;
  })
  .openapi(candidates, async (c) =>
    c.json(await service.transportCandidates(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(assign, async (c) => {
    const b = c.req.valid('json');
    return c.json(
      await service.assign(ctxOf(c), c.req.valid('param').id, b.driverId, b.vehicleId ?? null),
      200,
    );
  })
  .openapi(unassign, async (c) =>
    c.json(await service.unassign(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(cancel, async (c) =>
    c.json(await service.cancel(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(complete, async (c) => {
    return c.json(
      await service.complete(ctxOf(c), c.req.valid('param').id, c.req.valid('json')),
      200,
    );
  });
