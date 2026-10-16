import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam, jsonBody, ok } from '../../lib/http.js';
import * as service from './shifts.service.js';
import {
  AssignBody,
  AssignmentParams,
  CandidatesResponse,
  CopyWeek,
  CopyWeekResult,
  Shift,
  ShiftAssignment,
  ShiftCreate,
  ShiftPatch,
  ShiftsQuery,
  ShiftsResponse,
  ShiftType,
  ShiftTypeCreate,
  ShiftTypePatch,
  ShiftTypesResponse,
} from './shifts.schemas.js';

const base = { tags: ['shifts'], security: [{ bearerAuth: [] }] };
const noContent = { description: 'Eliminato' };

const types = createRoute({
  ...base,
  method: 'get',
  path: '/shift-types',
  middleware: [requirePermission('shifts.read')] as const,
  responses: { 200: ok(ShiftTypesResponse, 'Tipi di turno'), ...errs() },
});
const createType = createRoute({
  ...base,
  method: 'post',
  path: '/shift-types',
  middleware: [requirePermission('shifts.write')] as const,
  request: { body: jsonBody(ShiftTypeCreate) },
  responses: { 201: ok(ShiftType, 'Tipo creato'), ...errs(409) },
});
const patchType = createRoute({
  ...base,
  method: 'patch',
  path: '/shift-types/{id}',
  middleware: [requirePermission('shifts.write')] as const,
  request: { params: IdParam, body: jsonBody(ShiftTypePatch) },
  responses: { 200: ok(ShiftType, 'Tipo aggiornato'), ...errs(404, 409) },
});
const list = createRoute({
  ...base,
  method: 'get',
  path: '/shifts',
  middleware: [requirePermission('shifts.read')] as const,
  request: { query: ShiftsQuery },
  responses: { 200: ok(ShiftsResponse, 'Turni con copertura'), ...errs() },
});
const create = createRoute({
  ...base,
  method: 'post',
  path: '/shifts',
  middleware: [requirePermission('shifts.write')] as const,
  request: { body: jsonBody(ShiftCreate) },
  responses: { 201: ok(Shift, 'Turno creato'), ...errs(404) },
});
const copyWeek = createRoute({
  ...base,
  method: 'post',
  path: '/shifts/copy-week',
  middleware: [requirePermission('shifts.write')] as const,
  request: { body: jsonBody(CopyWeek) },
  responses: { 200: ok(CopyWeekResult, 'Turni copiati'), ...errs() },
});
const get = createRoute({
  ...base,
  method: 'get',
  path: '/shifts/{id}',
  middleware: [requirePermission('shifts.read')] as const,
  request: { params: IdParam },
  responses: { 200: ok(Shift, 'Turno'), ...errs(404) },
});
const patch = createRoute({
  ...base,
  method: 'patch',
  path: '/shifts/{id}',
  middleware: [requirePermission('shifts.write')] as const,
  request: { params: IdParam, body: jsonBody(ShiftPatch) },
  responses: { 200: ok(Shift, 'Turno aggiornato'), ...errs(404, 409) },
});
const del = createRoute({
  ...base,
  method: 'delete',
  path: '/shifts/{id}',
  middleware: [requirePermission('shifts.write')] as const,
  request: { params: IdParam },
  responses: { 204: noContent, ...errs(404) },
});
const candidates = createRoute({
  ...base,
  method: 'get',
  path: '/shifts/{id}/candidates',
  middleware: [requirePermission('shifts.assign')] as const,
  request: { params: IdParam },
  responses: { 200: ok(CandidatesResponse, 'Candidati ordinati'), ...errs(404) },
});
const assign = createRoute({
  ...base,
  method: 'post',
  path: '/shifts/{id}/assignments',
  middleware: [requirePermission('shifts.assign')] as const,
  request: { params: IdParam, body: jsonBody(AssignBody) },
  responses: { 201: ok(ShiftAssignment, 'Assegnazione creata'), ...errs(404, 409, 422) },
});
const unassign = createRoute({
  ...base,
  method: 'delete',
  path: '/shifts/{id}/assignments/{assignmentId}',
  middleware: [requirePermission('shifts.assign')] as const,
  request: { params: AssignmentParams },
  responses: { 204: noContent, ...errs(404) },
});

export const shiftsRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(types, async (c) => c.json(await service.types(ctxOf(c)), 200))
  .openapi(createType, async (c) =>
    c.json(await service.createType(ctxOf(c), c.req.valid('json')), 201),
  )
  .openapi(patchType, async (c) =>
    c.json(await service.updateType(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(create, async (c) => c.json(await service.create(ctxOf(c), c.req.valid('json')), 201))
  .openapi(copyWeek, async (c) =>
    c.json(await service.copyWeek(ctxOf(c), c.req.valid('json')), 200),
  )
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c), c.req.valid('param').id), 200))
  .openapi(patch, async (c) =>
    c.json(await service.update(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .openapi(del, async (c) => {
    await service.remove(ctxOf(c), c.req.valid('param').id);
    return c.body(null, 204);
  })
  .openapi(candidates, async (c) =>
    c.json(await service.shiftCandidates(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(assign, async (c) =>
    c.json(
      await service.assign(ctxOf(c), c.req.valid('param').id, c.req.valid('json').volunteerId),
      201,
    ),
  )
  .openapi(unassign, async (c) => {
    const p = c.req.valid('param');
    await service.unassign(ctxOf(c), p.id, p.assignmentId);
    return c.body(null, 204);
  });
