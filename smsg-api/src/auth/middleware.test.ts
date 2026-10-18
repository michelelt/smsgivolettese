import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const URL_ = vi.hoisted(() => {
  process.env.SUPABASE_URL = 'http://jwks.test';
  return 'http://jwks.test';
});

describe('authenticate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('caches the JWKS across requests', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' };
    const fetchMock = vi.fn(async () => Response.json({ keys: [jwk] }));
    vi.stubGlobal('fetch', fetchMock);
    const { Hono } = await import('hono');
    const { authenticate } = await import('./middleware.js');
    const app = new Hono().use(authenticate).get('/', (c) => c.json(c.get('user' as never)));
    const token = await new SignJWT({ app_role: 'staff' })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('u1')
      .setIssuer(`${URL_}/auth/v1`)
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .sign(privateKey);
    const call = () => app.request('/', { headers: { authorization: `Bearer ${token}` } });
    for (let i = 0; i < 3; i++) {
      const r = await call();
      expect(await r.json()).toEqual({ id: 'u1', role: 'staff' });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats an aal1 super admin as staff when MFA is required (ADR-063)', async () => {
    vi.resetModules(); // fresh JWKS cache
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k2', alg: 'ES256' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [jwk] })),
    );
    const { Hono } = await import('hono');
    const { authenticate, requirePermission } = await import('./middleware.js');
    const { env } = await import('../config/env.js');
    const { DomainError } = await import('../lib/errors.js');
    const app = new Hono()
      .use(authenticate)
      .get('/me', (c) => c.json(c.get('user' as never)))
      .get('/sa', requirePermission('users.reset_mfa'), (c) => c.text('ok'))
      .get('/staff', requirePermission('users.read'), (c) => c.text('ok'))
      .onError((e, c) =>
        e instanceof DomainError ? c.json({ code: e.code }, e.status) : c.text('x', 500),
      );
    const tok = (aal: string) =>
      new SignJWT({ app_role: 'super_admin', aal })
        .setProtectedHeader({ alg: 'ES256', kid: 'k2' })
        .setSubject('u1')
        .setIssuer(`${URL_}/auth/v1`)
        .setAudience('authenticated')
        .setExpirationTime('5m')
        .sign(privateKey);
    const get = async (path: string, aal: string) =>
      app.request(path, { headers: { authorization: `Bearer ${await tok(aal)}` } });
    env.SUPERADMIN_MFA = 'required';
    try {
      expect(await (await get('/me', 'aal1')).json()).toEqual({
        id: 'u1',
        role: 'staff',
        mfaPending: true,
      });
      const denied = await get('/sa', 'aal1');
      expect(denied.status).toBe(403);
      expect(await denied.json()).toEqual({ code: 'MFA_REQUIRED' });
      expect((await get('/staff', 'aal1')).status).toBe(200);
      expect((await get('/sa', 'aal2')).status).toBe(200);
      env.SUPERADMIN_MFA = 'off';
      expect((await get('/sa', 'aal1')).status).toBe(200);
    } finally {
      env.SUPERADMIN_MFA = undefined;
    }
  });
});
