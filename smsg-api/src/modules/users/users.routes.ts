import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, IdParam, jsonBody, ok } from '../../lib/http.js';
import {
  InviteBody,
  Invited,
  MfaReset,
  RoleBody,
  UserItem,
  UserPage,
  UsersQuery,
} from './users.schemas.js';
import * as service from './users.service.js';

const base = { tags: ['users'], security: [{ bearerAuth: [] }] };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/users',
  middleware: [requirePermission('users.read')] as const,
  request: { query: UsersQuery },
  responses: { 200: ok(UserPage, 'Utenti'), ...errs() },
});
const invite = createRoute({
  ...base,
  method: 'post',
  path: '/users/invite',
  middleware: [requirePermission('users.invite_volunteer')] as const,
  request: { body: jsonBody(InviteBody) },
  responses: { 201: ok(Invited, 'Invito inviato'), ...errs(409) },
});
const role = createRoute({
  ...base,
  method: 'patch',
  path: '/users/{id}',
  middleware: [requirePermission('users.change_role')] as const,
  request: { params: IdParam, body: jsonBody(RoleBody) },
  responses: { 200: ok(UserItem, 'Ruolo aggiornato'), ...errs(404, 409) },
});
const deactivate = createRoute({
  ...base,
  method: 'post',
  path: '/users/{id}/deactivate',
  middleware: [requirePermission('users.deactivate')] as const,
  request: { params: IdParam },
  responses: { 200: ok(UserItem, 'Utente disattivato'), ...errs(404, 409, 502) },
});
const reactivate = createRoute({
  ...base,
  method: 'post',
  path: '/users/{id}/reactivate',
  middleware: [requirePermission('users.deactivate')] as const,
  request: { params: IdParam },
  responses: { 200: ok(UserItem, 'Utente riattivato'), ...errs(404, 409, 502) },
});
const resetMfa = createRoute({
  ...base,
  method: 'delete',
  path: '/users/{id}/mfa',
  middleware: [requirePermission('users.reset_mfa')] as const,
  request: { params: IdParam },
  responses: { 200: ok(MfaReset, 'Autenticazione a due fattori azzerata'), ...errs(404, 409, 502) },
});

export const usersRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(invite, async (c) => c.json(await service.invite(ctxOf(c), c.req.valid('json')), 201))
  .openapi(role, async (c) =>
    c.json(
      await service.changeRole(ctxOf(c), c.req.valid('param').id, c.req.valid('json').role),
      200,
    ),
  )
  .openapi(deactivate, async (c) =>
    c.json(await service.deactivate(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(reactivate, async (c) =>
    c.json(await service.reactivate(ctxOf(c), c.req.valid('param').id), 200),
  )
  .openapi(resetMfa, async (c) =>
    c.json(await service.resetMfa(ctxOf(c), c.req.valid('param').id), 200),
  );
