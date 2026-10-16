import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { authenticate } from './auth/middleware.js';
import { DomainError, fromPostgres } from './lib/errors.js';
import { log } from './lib/logger.js';
import { meRoutes } from './modules/me/me.routes.js';
import { publicRoutes } from './modules/public/public.routes.js';
import { bookingsRoutes } from './modules/bookings/bookings.routes.js';
import { clientsRoutes } from './modules/clients/clients.routes.js';
import { invoicesRoutes } from './modules/invoices/invoices.routes.js';
import { membersRoutes } from './modules/members/members.routes.js';
import { servicesRoutes } from './modules/services/services.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';
import { cronRoutes } from './modules/cron/cron.routes.js';
import { shiftsRoutes } from './modules/shifts/shifts.routes.js';
import { transportsRoutes } from './modules/transports/transports.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { vehiclesRoutes } from './modules/vehicles/vehicles.routes.js';
import { volunteersRoutes } from './modules/volunteers/volunteers.routes.js';
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

// Authenticated responses carry personal data: never cached (public routes set their own policy).
app.use(async (c, next) => {
  await next();
  if (!c.req.path.startsWith('/public/') && !c.res.headers.has('cache-control'))
    c.header('Cache-Control', 'no-store');
});

app.route('/', healthRoutes);
app.route('/', meRoutes);
app.route('/', publicRoutes);
app.route('/', bookingsRoutes);
app.route('/', clientsRoutes);
app.route('/', membersRoutes);
app.route('/', invoicesRoutes);
app.route('/', servicesRoutes);
app.route('/', settingsRoutes);
app.route('/', volunteersRoutes);
app.route('/', vehiclesRoutes);
app.route('/', shiftsRoutes);
app.route('/', transportsRoutes);
app.route('/', usersRoutes);
app.route('/', cronRoutes);

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'SMS Givolettese API', version: '1.2.0' },
});

const body = (code: string, message: string, details?: unknown) => ({
  error: { code, message, ...(details === undefined ? {} : { details }) },
});

app.notFound((c) => c.json(body('NOT_FOUND', 'Risorsa non trovata'), 404));

app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json(body(err.code, err.message, err.details), err.status);
  }
  if (err instanceof HTTPException && err.status < 500) {
    if (err.status === 400) return c.json(body('VALIDATION_ERROR', 'Dati non validi'), 400);
    return c.json(body('HTTP_ERROR', 'Richiesta non valida'), err.status);
  }
  const pg = fromPostgres(err as { code?: string; constraint_name?: string; message?: string });
  if (pg) return c.json(body(pg.code, pg.message), pg.status);
  log('error', 'unhandled', { name: err.name }); // message may contain PII, not logged
  return c.json(body('INTERNAL_ERROR', 'Errore interno del server'), 500);
});
