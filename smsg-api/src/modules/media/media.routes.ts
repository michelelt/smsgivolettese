import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { ctxOf, defaultHook, errs, jsonBody, ok } from '../../lib/http.js';
import * as service from './media.service.js';
import { CompleteBody, Media, UploadTarget, UploadUrlBody } from './media.schemas.js';

const base = { tags: ['media'], security: [{ bearerAuth: [] }] };

const uploadUrl = createRoute({
  ...base,
  method: 'post',
  path: '/media/upload-url',
  middleware: [requirePermission('media.upload')] as const,
  request: { body: jsonBody(UploadUrlBody) },
  responses: { 200: ok(UploadTarget, 'URL di caricamento firmato'), ...errs(422) },
});
const complete = createRoute({
  ...base,
  method: 'post',
  path: '/media/complete',
  middleware: [requirePermission('media.upload')] as const,
  request: { body: jsonBody(CompleteBody) },
  responses: { 201: ok(Media, 'Media registrato'), ...errs(409, 422) },
});

export const mediaRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(uploadUrl, async (c) =>
    c.json(await service.uploadUrl(ctxOf(c), c.req.valid('json')), 200),
  )
  .openapi(complete, async (c) =>
    c.json(await service.complete(ctxOf(c), c.req.valid('json')), 201),
  );
