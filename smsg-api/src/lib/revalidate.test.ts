import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.WEB_URL = 'http://web.test';
  process.env.REVALIDATE_SECRET = 'revalidate-secret-test';
});
import { revalidate } from './revalidate.js';

afterEach(() => vi.unstubAllGlobals());

describe('revalidate', () => {
  it('posts tags with the secret header', async () => {
    const m = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', m);
    await revalidate(['services']);
    const [url, init] = m.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://web.test/hooks/revalidate');
    expect((init.headers as Record<string, string>)['x-revalidate-secret']).toBe(
      'revalidate-secret-test',
    );
    expect(init.body).toBe('{"tags":["services"]}');
  });
  it('never throws', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('down');
    });
    await expect(revalidate(['services'])).resolves.toBeUndefined();
  });
});
