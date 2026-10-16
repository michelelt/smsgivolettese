import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, jsonBody, ok } from '../../lib/http.js';
import { InviteBody, Invited } from './users.schemas.js';
import * as service from './users.service.js';

const invite = createRoute({
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  method: 'post',
  path: '/users/invite',
  middleware: [requirePermission('users.invite_volunteer')] as const,
  request: { body: jsonBody(InviteBody) },
  responses: { 201: ok(Invited, 'Invito inviato'), ...errs(409) },
});

export const usersRoutes = new OpenAPIHono<AuthEnv>({ defaultHook }).openapi(invite, async (c) =>
  c.json(await service.invite(ctxOf(c), c.req.valid('json')), 201),
);
