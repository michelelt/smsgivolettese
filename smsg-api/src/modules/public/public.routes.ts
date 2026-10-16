import { createRoute, OpenAPIHono, type Hook } from '@hono/zod-openapi';
import { ValidationError } from '../../lib/errors.js';
import * as service from './public.service.js';
import { ServicesResponse, SiteSettings } from './public.schemas.js';

// Public endpoints: permissions 'services.read_public' / 'site_settings.read' are anon, so no middleware.
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
export const publicRoutes = new OpenAPIHono({ defaultHook })
  .openapi(services, async (c) => c.json({ items: await service.listServices(rid(c)) }, 200))
  .openapi(settings, async (c) => c.json(await service.getSiteSettings(rid(c)), 200));
