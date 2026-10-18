import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam, ok } from '../../lib/http.js';
import { StaffPost } from '../posts/posts.schemas.js';
import * as service from './proposals.service.js';
import { Proposal, ProposalList, ProposalsQuery } from './proposals.schemas.js';

const base = { tags: ['proposals'], security: [{ bearerAuth: [] }] };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/proposals',
  middleware: [requirePermission('proposals.read')] as const,
  request: { query: ProposalsQuery },
  responses: { 200: ok(ProposalList, 'Proposte'), ...errs() },
});
const get = createRoute({
  ...base,
  method: 'get',
  path: '/proposals/{id}',
  middleware: [requirePermission('proposals.read')] as const,
  request: { params: IdParam },
  responses: { 200: ok(Proposal, 'Proposta'), ...errs(404) },
});
const draft = createRoute({
  ...base,
  method: 'post',
  path: '/proposals/{id}/draft',
  middleware: [requirePermission('proposals.moderate')] as const,
  request: { params: IdParam },
  responses: {
    200: ok(StaffPost, 'Bozza già esistente'),
    201: ok(StaffPost, 'Bozza creata'),
    ...errs(404, 409),
  },
});
const publish = createRoute({
  ...base,
  method: 'post',
  path: '/proposals/{id}/publish',
  middleware: [requirePermission('proposals.moderate')] as const,
  request: { params: IdParam },
  responses: { 200: ok(StaffPost, 'Articolo pubblicato'), ...errs(404, 409, 422) },
});
const reject = createRoute({
  ...base,
  method: 'post',
  path: '/proposals/{id}/reject',
  middleware: [requirePermission('proposals.moderate')] as const,
  request: { params: IdParam },
  responses: { 200: ok(Proposal, 'Proposta rifiutata'), ...errs(404, 409) },
});

export const proposalsRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c), c.req.valid('param').id), 200))
  .openapi(draft, async (c) => {
    const r = await service.draft(ctxOf(c), c.req.valid('param').id);
    return r.created ? c.json(r.post, 201) : c.json(r.post, 200);
  })
  .openapi(publish, async (c) =>
    c.json(await service.publish(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(reject, async (c) =>
    c.json(await service.reject(ctxOf(c), c.req.valid('param').id), 200),
  );
