import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
});
import { env } from '../config/env.js';
import { verifyTurnstile } from './turnstile.js';

afterEach(() => vi.unstubAllGlobals());
const stub = (f: () => unknown) => {
  const m = vi.fn(f);
  vi.stubGlobal('fetch', m);
  return m;
};
const ok =
  (body: unknown, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status });

describe('verifyTurnstile', () => {
  it('empty token fails without calling Cloudflare', async () => {
    const m = stub(ok({ success: true }));
    expect(await verifyTurnstile('', '1.1.1.1')).toBe(false);
    expect(m).not.toHaveBeenCalled();
  });
  it('success true passes', async () => {
    stub(ok({ success: true }));
    expect(await verifyTurnstile('t', '1.1.1.1')).toBe(true);
  });
  it('success false, HTTP error and network error fail closed', async () => {
    stub(ok({ success: false }));
    expect(await verifyTurnstile('t', 'i')).toBe(false);
    stub(ok({ success: true }, 500));
    expect(await verifyTurnstile('t', 'i')).toBe(false);
    stub(() => {
      throw new Error('down');
    });
    expect(await verifyTurnstile('t', 'i')).toBe(false);
  });
  it('omits remoteip for the local fallback', async () => {
    const m = stub(ok({ success: true }));
    await verifyTurnstile('t', 'local');
    const init = (m.mock.calls as unknown as [string, RequestInit][])[0]![1];
    expect((init.body as URLSearchParams).has('remoteip')).toBe(false);
  });
  it('checks hostname against WEB_URL only in production', async () => {
    const prev = { ...env };
    env.WEB_URL = 'https://smsg.example';
    stub(ok({ success: true, hostname: 'evil.example' }));
    expect(await verifyTurnstile('t', 'i')).toBe(true);
    env.NODE_ENV = 'production';
    expect(await verifyTurnstile('t', 'i')).toBe(false);
    stub(ok({ success: true, hostname: 'smsg.example' }));
    expect(await verifyTurnstile('t', 'i')).toBe(true);
    Object.assign(env, prev);
  });
});
