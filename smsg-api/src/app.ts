import { OpenAPIHono } from '@hono/zod-openapi';
import { secureHeaders } from 'hono/secure-headers';
import { authenticate } from './auth/middleware.js';
import { DomainError, fromPostgres } from './lib/errors.js';
import { log } from './lib/logger.js';
import { meRoutes } from './modules/me/me.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';

export const app = new OpenAPIHono();

app.use(secureHeaders());

app.use(async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  c.set('requestId' as never, requestId as never);
  const start = Date.now();
  await next();
  c.header('x-request-id', requestId);
  log('info', 'request', {
    requestId,
    method: c.req.method,
    route: c.req.routePath,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});

app.use(authenticate);

app.route('/', healthRoutes);
app.route('/', meRoutes);

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'SMS Givolettese API', version: '0.1.0' },
});

const body = (code: string, message: string, details?: unknown) => ({
  error: { code, message, ...(details === undefined ? {} : { details }) },
});

app.notFound((c) => c.json(body('NOT_FOUND', 'Risorsa non trovata'), 404));

app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json(body(err.code, err.message, err.details), err.status);
  }
  const pg = fromPostgres(err as { code?: string; message?: string });
  if (pg) return c.json(body(pg.code, pg.message), pg.status);
  log('error', 'unhandled', { name: err.name }); // message may contain PII, not logged
  return c.json(body('INTERNAL_ERROR', 'Errore interno del server'), 500);
});
