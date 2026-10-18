import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { attachment, ctxOf, defaultHook, errs, fileContent, jsonBody, ok } from '../../lib/http.js';
import { AnonymizeBody, Anonymized, ExportQuery } from './gdpr.schemas.js';
import * as service from './gdpr.service.js';

const base = { tags: ['gdpr'], security: [{ bearerAuth: [] }] };

const exportRoute = createRoute({
  ...base,
  method: 'get',
  path: '/gdpr/export',
  middleware: [requirePermission('gdpr.export')] as const,
  request: { query: ExportQuery },
  responses: { 200: fileContent('application/json'), ...errs(404) },
});
const anonymize = createRoute({
  ...base,
  method: 'post',
  path: '/gdpr/anonymize',
  middleware: [requirePermission('gdpr.anonymize')] as const,
  request: { body: jsonBody(AnonymizeBody) },
  responses: { 200: ok(Anonymized, 'Dati anonimizzati'), ...errs(404, 409, 502) },
});

export const gdprRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(exportRoute, async (c) => {
    const { subject, id } = c.req.valid('query');
    const f = await service.exportData(ctxOf(c), subject, id);
    return attachment(f.body, 'application/json; charset=utf-8', f.filename) as never;
  })
  .openapi(anonymize, async (c) =>
    c.json(await service.anonymize(ctxOf(c), c.req.valid('json')), 200),
  );
