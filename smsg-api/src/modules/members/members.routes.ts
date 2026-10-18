import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { attachment, ctxOf, defaultHook, errs, fileContent, IdParam } from '../../lib/http.js';
import * as service from './members.service.js';
import {
  Fee,
  FeeCreate,
  FeeParams,
  MemberCreate,
  MemberDetail,
  MemberEnd,
  MemberKpis,
  MemberPage,
  MemberPatch,
  MembersQuery,
} from './members.schemas.js';

const sec = [{ bearerAuth: [] }];
const ok = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  content: { 'application/json': { schema } },
  required: true as const,
});
const base = { tags: ['members'], security: sec };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/members',
  middleware: [requirePermission('members.read')] as const,
  request: { query: MembersQuery },
  responses: { 200: ok(MemberPage, 'Soci'), ...errs() },
});
const kpis = createRoute({
  ...base,
  method: 'get',
  path: '/members/kpis',
  middleware: [requirePermission('members.read')] as const,
  responses: { 200: ok(MemberKpis, 'Indicatori'), ...errs() },
});
const csv = createRoute({
  ...base,
  method: 'get',
  path: '/members/export.csv',
  middleware: [requirePermission('members.export')] as const,
  responses: { 200: fileContent('text/csv'), ...errs() },
});
const get = createRoute({
  ...base,
  method: 'get',
  path: '/members/{id}',
  middleware: [requirePermission('members.read')] as const,
  request: { params: IdParam },
  responses: {
    200: ok(MemberDetail, 'Socio con quote e storico (prenotazioni, trasporti, fatture)'),
    ...errs(404),
  },
});
const create = createRoute({
  ...base,
  method: 'post',
  path: '/members',
  middleware: [requirePermission('members.write')] as const,
  request: { body: body(MemberCreate) },
  responses: { 201: ok(MemberDetail, 'Socio registrato'), ...errs(404, 409, 422) },
});
const patch = createRoute({
  ...base,
  method: 'patch',
  path: '/members/{id}',
  middleware: [requirePermission('members.write')] as const,
  request: { params: IdParam, body: body(MemberPatch) },
  responses: { 200: ok(MemberDetail, 'Socio aggiornato'), ...errs(404, 409, 422) },
});
const end = createRoute({
  ...base,
  method: 'post',
  path: '/members/{id}/end',
  middleware: [requirePermission('members.end')] as const,
  request: { params: IdParam, body: body(MemberEnd) },
  responses: { 200: ok(MemberDetail, 'Socio cessato'), ...errs(404, 409) },
});
const reactivate = createRoute({
  ...base,
  method: 'post',
  path: '/members/{id}/reactivate',
  middleware: [requirePermission('members.end')] as const,
  request: { params: IdParam },
  responses: { 200: ok(MemberDetail, 'Socio riattivato'), ...errs(404, 409) },
});
const addFee = createRoute({
  ...base,
  method: 'post',
  path: '/members/{id}/fees',
  middleware: [requirePermission('membership_fees.write')] as const,
  request: { params: IdParam, body: body(FeeCreate) },
  responses: { 201: ok(Fee, 'Quota registrata'), ...errs(404, 409) },
});
const receipt = createRoute({
  ...base,
  method: 'get',
  path: '/members/{id}/fees/{feeId}/receipt.pdf',
  middleware: [requirePermission('members.read')] as const,
  request: { params: FeeParams },
  responses: { 200: fileContent('application/pdf'), ...errs(404) },
});

export const membersRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(kpis, async (c) => c.json(await service.kpis(ctxOf(c)), 200))
  .openapi(csv, async (c) => {
    const f = await service.csv(ctxOf(c));
    return attachment(f.body, 'text/csv; charset=utf-8', f.filename) as never;
  })
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c), c.req.valid('param').id), 200))
  .openapi(create, async (c) => c.json(await service.create(ctxOf(c), c.req.valid('json')), 201))
  .openapi(patch, async (c) =>
    c.json(await service.update(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .openapi(end, async (c) =>
    c.json(await service.end(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .openapi(reactivate, async (c) =>
    c.json(await service.reactivate(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(addFee, async (c) =>
    c.json(await service.addFee(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 201),
  )
  .openapi(receipt, async (c) => {
    const p = c.req.valid('param');
    const f = await service.receipt(ctxOf(c), p.id, p.feeId);
    return attachment(f.body, 'application/pdf', f.filename) as never;
  });
