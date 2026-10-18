import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, ok } from '../../lib/http.js';
import { AuditPage, AuditQuery } from './audit.schemas.js';
import * as service from './audit.service.js';

const list = createRoute({
  tags: ['audit'],
  security: [{ bearerAuth: [] }],
  method: 'get',
  path: '/audit',
  middleware: [requirePermission('audit.read')] as const,
  request: { query: AuditQuery },
  responses: { 200: ok(AuditPage, 'Registro attività'), ...errs() },
});

export const auditRoutes = new OpenAPIHono<AuthEnv>({ defaultHook }).openapi(list, async (c) =>
  c.json(await service.list(ctxOf(c), c.req.valid('query')), 200),
);
