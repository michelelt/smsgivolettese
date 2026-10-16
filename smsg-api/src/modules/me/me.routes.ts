import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { Me } from './me.schemas.js';

const route = createRoute({
  method: 'get',
  path: '/me',
  tags: ['me'],
  security: [{ bearerAuth: [] }],
  middleware: [requirePermission('me.read')] as const,
  responses: {
    200: { content: { 'application/json': { schema: Me } }, description: 'Utente corrente' },
    401: { description: 'Non autenticato' },
    403: { description: 'Nessun ruolo attivo' },
  },
});

export const meRoutes = new OpenAPIHono<AuthEnv>().openapi(route, (c) => {
  const u = c.get('user')!; // requirePermission guarantees an authenticated role
  return c.json({ id: u.id, role: u.role! }, 200);
});
