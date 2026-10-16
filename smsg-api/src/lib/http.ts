import { z, type Hook } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { AuthEnv } from '../auth/middleware.js';
import type { Ctx } from './ctx.js';
import { ValidationError } from './errors.js';

// Details carry paths only, never the submitted values.
export const defaultHook: Hook<unknown, AuthEnv, string, unknown> = (r) => {
  if (!r.success) {
    throw new ValidationError(
      'Dati non validi',
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
};

export const ctxOf = (c: Context<AuthEnv>): Ctx => ({
  user: c.get('user')!, // requirePermission guarantees an authenticated role
  requestId: c.get('requestId' as never) as string | undefined,
});

export const IdParam = z.object({ id: z.uuid() });

export const ErrorBody = z
  .object({
    error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
  })
  .openapi('ErrorBody');

const DESC = {
  400: 'Dati non validi',
  401: 'Non autenticato',
  403: 'Permesso negato',
  404: 'Non trovato',
  409: 'Conflitto con lo stato attuale',
  422: 'Richiede conferma o non elaborabile',
} as const;
type ErrStatus = keyof typeof DESC;
/** Standard error responses (400/401/403 always) plus the given extra statuses. */
export const errs = (...extra: ErrStatus[]) =>
  Object.fromEntries(
    ([400, 401, 403, ...extra] as ErrStatus[]).map((s) => [
      s,
      { content: { 'application/json': { schema: ErrorBody } }, description: DESC[s] },
    ]),
  ) as Record<
    ErrStatus,
    { content: { 'application/json': { schema: typeof ErrorBody } }; description: string }
  >;

export const fileContent = (mime: string) => ({
  content: { [mime]: { schema: z.string().openapi({ type: 'string', format: 'binary' }) } },
  description: 'File',
});

/** Attachment response, never cached (ADR-045). */
export const attachment = (body: Buffer | string, mime: string, filename: string) =>
  new Response(body as BodyInit, {
    headers: {
      'content-type': mime,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
