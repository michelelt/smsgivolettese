import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { HealthResponse } from './health.schemas.js';

const route = createRoute({
  method: 'get',
  path: '/health',
  tags: ['health'],
  // Public: no permission required.
  responses: {
    200: {
      content: { 'application/json': { schema: HealthResponse } },
      description: 'Servizio attivo',
    },
  },
});

export const healthRoutes = new OpenAPIHono().openapi(route, (c) =>
  c.json({ status: 'ok' as const }, 200),
);
