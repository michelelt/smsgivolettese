import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam, jsonBody, ok } from '../../lib/http.js';
import * as service from './posts.service.js';
import {
  PostCreate,
  PostPatch,
  StaffPost,
  StaffPostList,
  StaffPostsQuery,
} from './posts.schemas.js';

const base = { tags: ['posts'], security: [{ bearerAuth: [] }] };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/posts',
  middleware: [requirePermission('posts.read_drafts')] as const,
  request: { query: StaffPostsQuery },
  responses: { 200: ok(StaffPostList, 'Articoli'), ...errs() },
});
const get = createRoute({
  ...base,
  method: 'get',
  path: '/posts/{id}',
  middleware: [requirePermission('posts.read_drafts')] as const,
  request: { params: IdParam },
  responses: { 200: ok(StaffPost, 'Articolo'), ...errs(404) },
});
const create = createRoute({
  ...base,
  method: 'post',
  path: '/posts',
  middleware: [requirePermission('posts.write')] as const,
  request: { body: jsonBody(PostCreate) },
  responses: { 201: ok(StaffPost, 'Bozza creata'), ...errs(409, 422) },
});
const patch = createRoute({
  ...base,
  method: 'patch',
  path: '/posts/{id}',
  middleware: [requirePermission('posts.write')] as const,
  request: { params: IdParam, body: jsonBody(PostPatch) },
  responses: { 200: ok(StaffPost, 'Articolo aggiornato'), ...errs(404, 409, 422) },
});
const publish = createRoute({
  ...base,
  method: 'post',
  path: '/posts/{id}/publish',
  middleware: [requirePermission('posts.publish')] as const,
  request: { params: IdParam },
  responses: { 200: ok(StaffPost, 'Articolo pubblicato'), ...errs(404, 409, 422) },
});
const unpublish = createRoute({
  ...base,
  method: 'post',
  path: '/posts/{id}/unpublish',
  middleware: [requirePermission('posts.publish')] as const,
  request: { params: IdParam },
  responses: { 200: ok(StaffPost, 'Articolo riportato in bozza'), ...errs(404, 409) },
});
const del = createRoute({
  ...base,
  method: 'delete',
  path: '/posts/{id}',
  middleware: [requirePermission('posts.delete')] as const,
  request: { params: IdParam },
  responses: { 204: { description: 'Eliminato' }, ...errs(404) },
});

export const postsRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c), c.req.valid('param').id), 200))
  .openapi(create, async (c) => c.json(await service.create(ctxOf(c), c.req.valid('json')), 201))
  .openapi(patch, async (c) =>
    c.json(await service.update(ctxOf(c), c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .openapi(publish, async (c) =>
    c.json(await service.publish(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(unpublish, async (c) =>
    c.json(await service.unpublish(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(del, async (c) => {
    await service.remove(ctxOf(c), c.req.valid('param').id);
    return c.body(null, 204);
  });
