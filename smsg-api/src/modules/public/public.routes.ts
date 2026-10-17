import { createRoute, OpenAPIHono, type Hook } from '@hono/zod-openapi';
import { clientIp } from '../../lib/client-ip.js';
import { ValidationError } from '../../lib/errors.js';
import { errs, jsonBody, ok } from '../../lib/http.js';
import { UploadTarget } from '../media/media.schemas.js';
import {
  GalleryList,
  GalleryQuery,
  PublicPost,
  PublicPostList,
  PublicPostsQuery,
  SlugParam,
} from '../posts/posts.schemas.js';
import * as posts from '../posts/posts.service.js';
import {
  ProposalCreated,
  ProposalSubmit,
  ProposalUploadBody,
} from '../proposals/proposals.schemas.js';
import * as proposals from '../proposals/proposals.service.js';
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
const postList = createRoute({
  method: 'get',
  path: '/public/posts',
  tags: ['public'],
  request: { query: PublicPostsQuery },
  responses: { 200: ok(PublicPostList, 'Articoli pubblicati'), 400: errs()[400] },
});
const postDetail = createRoute({
  method: 'get',
  path: '/public/posts/{slug}',
  tags: ['public'],
  request: { params: SlugParam },
  responses: { 200: ok(PublicPost, 'Articolo'), 404: errs(404)[404] },
});
const gallery = createRoute({
  method: 'get',
  path: '/public/gallery',
  tags: ['public'],
  request: { query: GalleryQuery },
  responses: { 200: ok(GalleryList, 'Copertine degli articoli'), 400: errs()[400] },
});
const proposalUpload = createRoute({
  method: 'post',
  path: '/public/proposals/upload-url',
  tags: ['public'],
  request: { body: jsonBody(ProposalUploadBody) },
  responses: {
    200: ok(UploadTarget, 'URL di caricamento firmato'),
    400: errs()[400],
    422: errs(422)[422],
    429: errs(429)[429],
  },
});
const proposalSubmit = createRoute({
  method: 'post',
  path: '/public/proposals',
  tags: ['public'],
  request: { body: jsonBody(ProposalSubmit) },
  responses: {
    201: ok(ProposalCreated, 'Proposta ricevuta'),
    400: errs()[400],
    422: errs(422)[422],
    429: errs(429)[429],
  },
});

const ip = (c: { req: { header: (n: string) => string | undefined } }) =>
  clientIp((n) => c.req.header(n));

export const publicRoutes = new OpenAPIHono({ defaultHook })
  .openapi(services, async (c) => c.json({ items: await service.listServices(rid(c)) }, 200))
  .openapi(settings, async (c) => c.json(await service.getSiteSettings(rid(c)), 200))
  .openapi(postList, async (c) => c.json(await posts.listPublic(c.req.valid('query'), rid(c)), 200))
  .openapi(postDetail, async (c) =>
    c.json(await posts.getPublic(c.req.valid('param').slug, rid(c)), 200),
  )
  .openapi(gallery, async (c) => c.json(await posts.gallery(c.req.valid('query'), rid(c)), 200))
  .openapi(proposalUpload, async (c) =>
    c.json(await proposals.uploadUrl(c.req.valid('json'), ip(c)), 200),
  )
  .openapi(proposalSubmit, async (c) =>
    c.json(await proposals.submit(c.req.valid('json'), ip(c), rid(c)), 201),
  );
