import { verifyWithJwks } from 'hono/jwt';
import { createMiddleware } from 'hono/factory';
import { env } from '../config/env.js';
import { Forbidden, Unauthorized } from '../lib/errors.js';
import { can, isAppRole, type Action, type AppRole } from './permissions.js';

export type AuthUser = { id: string; role: AppRole | null };
export type AuthEnv = { Variables: { user: AuthUser | null } };

/** Verifies the bearer token against the Supabase JWKS. Anonymous (no header) -> user null. */
export const authenticate = createMiddleware<AuthEnv>(async (c, next) => {
  const m = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '');
  let user: AuthUser | null = null;
  if (m) {
    if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL is not set');
    try {
      const p = await verifyWithJwks(m[1]!, {
        jwks_uri: `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
        allowedAlgorithms: ['ES256', 'RS256'],
        verification: { iss: `${env.SUPABASE_URL}/auth/v1`, aud: 'authenticated' },
      });
      if (typeof p.sub !== 'string') throw new Error('no sub');
      user = { id: p.sub, role: isAppRole(p.app_role) ? p.app_role : null };
    } catch {
      throw new Unauthorized('Sessione non valida o scaduta');
    }
  }
  c.set('user', user);
  await next();
});

/** Every route declares its permission here; no inline role checks. */
export const requirePermission = (action: Action) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get('user');
    const role = user?.role ?? null;
    if (!can(role, action)) {
      if (!user) throw new Unauthorized();
      throw new Forbidden();
    }
    await next();
  });
