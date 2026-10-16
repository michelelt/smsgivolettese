import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam } from '../../lib/http.js';
import * as service from './bookings.service.js';
import {
  Booking,
  BookingCancel,
  BookingConfirm,
  BookingCreate,
  BookingKpis,
  BookingPage,
  BookingsQuery,
} from './bookings.schemas.js';

const sec = [{ bearerAuth: [] }];
const ok = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  content: { 'application/json': { schema } },
  required: true as const,
});
const base = { tags: ['bookings'], security: sec };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/bookings',
  middleware: [requirePermission('bookings.read')] as const,
  request: { query: BookingsQuery },
  responses: { 200: ok(BookingPage, 'Prenotazioni'), ...errs() },
});
const kpis = createRoute({
  ...base,
  method: 'get',
  path: '/bookings/kpis',
  middleware: [requirePermission('bookings.read')] as const,
  responses: { 200: ok(BookingKpis, 'Indicatori'), ...errs() },
});
const create = createRoute({
  ...base,
  method: 'post',
  path: '/bookings',
  middleware: [requirePermission('bookings.write')] as const,
  request: { body: body(BookingCreate) },
  responses: { 201: ok(Booking, 'Prenotazione creata'), ...errs(404, 422) },
});

const confirm = createRoute({
  ...base,
  method: 'post',
  path: '/bookings/{id}/confirm',
  middleware: [requirePermission('bookings.change_status')] as const,
  request: { params: IdParam, body: { ...body(BookingConfirm), required: false } },
  responses: { 200: ok(Booking, 'Prenotazione aggiornata'), ...errs(404, 409) },
});
const execute = createRoute({
  ...base,
  method: 'post',
  path: '/bookings/{id}/execute',
  middleware: [requirePermission('bookings.change_status')] as const,
  request: { params: IdParam },
  responses: { 200: ok(Booking, 'Prenotazione aggiornata'), ...errs(404, 409) },
});
const cancel = createRoute({
  ...base,
  method: 'post',
  path: '/bookings/{id}/cancel',
  middleware: [requirePermission('bookings.change_status')] as const,
  request: { params: IdParam, body: body(BookingCancel) },
  responses: { 200: ok(Booking, 'Prenotazione aggiornata'), ...errs(404, 409) },
});
const restore = createRoute({
  ...base,
  method: 'post',
  path: '/bookings/{id}/restore',
  middleware: [requirePermission('bookings.change_status')] as const,
  request: { params: IdParam },
  responses: { 200: ok(Booking, 'Prenotazione aggiornata'), ...errs(404, 409) },
});

export const bookingsRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(kpis, async (c) => c.json(await service.kpis(ctxOf(c)), 200))
  .openapi(create, async (c) => c.json(await service.create(ctxOf(c), c.req.valid('json')), 201))
  .openapi(confirm, async (c) =>
    c.json(
      await service.confirm(ctxOf(c), c.req.valid('param').id, (c.req.valid('json') ?? {}).time),
      200,
    ),
  )
  .openapi(execute, async (c) =>
    c.json(await service.execute(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(cancel, async (c) =>
    c.json(await service.cancel(ctxOf(c), c.req.valid('param').id, c.req.valid('json').by), 200),
  )
  .openapi(restore, async (c) =>
    c.json(await service.restore(ctxOf(c), c.req.valid('param').id), 200),
  );
