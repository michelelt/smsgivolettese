import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam, jsonBody, ok } from '../../lib/http.js';
import * as service from './me.service.js';
import {
  AbsenceCreate,
  AbsenceCreated,
  Me,
  MyAbsences,
  MyAvailability,
  MyAvailabilityPut,
  MyCommitments,
  MyTransportComplete,
  Respond,
} from './me.schemas.js';

const base = { tags: ['me'], security: [{ bearerAuth: [] }] };
const done = { description: 'Fatto' };

const me = createRoute({
  ...base,
  method: 'get',
  path: '/me',
  middleware: [requirePermission('me.read')] as const,
  responses: {
    200: { content: { 'application/json': { schema: Me } }, description: 'Utente corrente' },
    401: { description: 'Non autenticato' },
    403: { description: 'Nessun ruolo attivo' },
  },
});
const getAvail = createRoute({
  ...base,
  method: 'get',
  path: '/me/availability',
  middleware: [requirePermission('availability.read_own')] as const,
  responses: { 200: ok(MyAvailability, 'Disponibilità settimanale'), ...errs() },
});
const putAvail = createRoute({
  ...base,
  method: 'put',
  path: '/me/availability',
  middleware: [requirePermission('availability.write_own')] as const,
  request: { body: jsonBody(MyAvailabilityPut) },
  responses: { 200: ok(MyAvailability, 'Disponibilità salvata'), ...errs() },
});
const getAbs = createRoute({
  ...base,
  method: 'get',
  path: '/me/absences',
  middleware: [requirePermission('availability.read_own')] as const,
  responses: { 200: ok(MyAbsences, 'Assenze future'), ...errs() },
});
const postAbs = createRoute({
  ...base,
  method: 'post',
  path: '/me/absences',
  middleware: [requirePermission('availability.write_own')] as const,
  request: { body: jsonBody(AbsenceCreate) },
  responses: { 201: ok(AbsenceCreated, 'Assenza registrata'), ...errs() },
});
const delAbs = createRoute({
  ...base,
  method: 'delete',
  path: '/me/absences/{id}',
  middleware: [requirePermission('availability.write_own')] as const,
  request: { params: IdParam },
  responses: { 204: done, ...errs(404) },
});
const commitments = createRoute({
  ...base,
  method: 'get',
  path: '/me/commitments',
  middleware: [
    requirePermission('shift_assignments.read_own'),
    requirePermission('transports.read_own'),
  ] as const,
  responses: { 200: ok(MyCommitments, 'Impegni'), ...errs() },
});
const respondShift = createRoute({
  ...base,
  method: 'post',
  path: '/me/shift-assignments/{id}/respond',
  middleware: [requirePermission('shift_assignments.respond_own')] as const,
  request: { params: IdParam, body: jsonBody(Respond) },
  responses: { 204: done, ...errs(404, 409) },
});
const respondTransport = createRoute({
  ...base,
  method: 'post',
  path: '/me/transports/{id}/respond',
  middleware: [requirePermission('transports.respond_own')] as const,
  request: { params: IdParam, body: jsonBody(Respond) },
  responses: { 204: done, ...errs(404, 409) },
});
const completeTransport = createRoute({
  ...base,
  method: 'post',
  path: '/me/transports/{id}/complete',
  middleware: [requirePermission('transports.complete_own')] as const,
  request: { params: IdParam, body: jsonBody(MyTransportComplete) },
  responses: { 204: done, ...errs(404, 409) },
});

export const meRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(me, (c) => {
    const u = c.get('user')!; // requirePermission guarantees an authenticated role
    return c.json({ id: u.id, role: u.role! }, 200);
  })
  .openapi(getAvail, async (c) => c.json(await service.availability(ctxOf(c)), 200))
  .openapi(putAvail, async (c) =>
    c.json(await service.putAvailability(ctxOf(c), c.req.valid('json').rules), 200),
  )
  .openapi(getAbs, async (c) => c.json(await service.absences(ctxOf(c)), 200))
  .openapi(postAbs, async (c) =>
    c.json(await service.addAbsence(ctxOf(c), c.req.valid('json')), 201),
  )
  .openapi(delAbs, async (c) => {
    await service.deleteAbsence(ctxOf(c), c.req.valid('param').id);
    return c.body(null, 204);
  })
  .openapi(commitments, async (c) => c.json(await service.commitments(ctxOf(c)), 200))
  .openapi(respondShift, async (c) => {
    await service.respondShift(ctxOf(c), c.req.valid('param').id, c.req.valid('json').accept);
    return c.body(null, 204);
  })
  .openapi(respondTransport, async (c) => {
    await service.respondTransport(ctxOf(c), c.req.valid('param').id, c.req.valid('json').accept);
    return c.body(null, 204);
  })
  .openapi(completeTransport, async (c) => {
    const b = c.req.valid('json');
    await service.completeTransport(ctxOf(c), c.req.valid('param').id, b.km, b.driverNotes);
    return c.body(null, 204);
  });
