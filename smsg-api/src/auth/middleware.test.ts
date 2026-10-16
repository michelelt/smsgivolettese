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
});
