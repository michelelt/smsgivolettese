import { createRoute, OpenAPIHono, type Hook } from '@hono/zod-openapi';
import { clientIp } from '../../lib/client-ip.js';
import { ValidationError } from '../../lib/errors.js';
import * as service from './public.service.js';
import { BookingCreated, BookingInput, ServicesResponse, SiteSettings } from './public.schemas.js';

// Public endpoints: permissions 'services.read_public' / 'bookings.submit_public' are anon, so no middleware.
// Details carry paths only, never the submitted values.
const defaultHook: Hook<unknown, never, string, unknown> = (r) => {
  if (!r.success) {
    throw new ValidationError(
      'Dati non validi',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
};

const rid = (c: { get: (k: never) => unknown }) =>
  c.get('requestId' as never) as string | undefined;

const services = createRoute({
  method: 'get',
  path: '/public/services',
  tags: ['public'],
  responses: {
    200: {
      content: { 'application/json': { schema: ServicesResponse } },
      description: 'Servizi attivi',
    },
  },
});
const settings = createRoute({
  method: 'get',
  path: '/public/site-settings',
  tags: ['public'],
  responses: {
    200: {
      content: { 'application/json': { schema: SiteSettings } },
      description: 'Impostazioni del sito',
    },
  },
});
const booking = createRoute({
  method: 'post',
  path: '/public/bookings',
  tags: ['public'],
  request: { body: { content: { 'application/json': { schema: BookingInput } }, required: true } },
  responses: {
    201: {
      content: { 'application/json': { schema: BookingCreated } },
      description: 'Prenotazione creata',
    },
    400: { description: 'VALIDATION_ERROR o TURNSTILE_FAILED' },
    422: { description: 'INVALID_DAY o SERVICE_NOT_BOOKABLE' },
    429: { description: 'RATE_LIMITED' },
  },
});

export const publicRoutes = new OpenAPIHono({ defaultHook })
  .openapi(services, async (c) => c.json({ items: await service.listServices(rid(c)) }, 200))
  .openapi(settings, async (c) => c.json(await service.getSiteSettings(rid(c)), 200))
  .openapi(booking, async (c) => {
    const ip = clientIp((n) => c.req.header(n));
    return c.json(await service.submitBooking(c.req.valid('json'), ip, rid(c)), 201);
  });
