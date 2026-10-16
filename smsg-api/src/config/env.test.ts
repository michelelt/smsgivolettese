import { describe, expect, it } from 'vitest';
import { schema } from './env.js';

const good = {
  NODE_ENV: 'production',
  API_PROXY_SECRET: 'prod-proxy-secret-0123',
  REVALIDATE_SECRET: 'prod-revalidate-secret-0123',
  TURNSTILE_SECRET_KEY: '0x4AAAA',
  WEB_URL: 'https://example.org',
};

describe('env in production', () => {
  it('accepts real secrets', () => {
    expect(schema.safeParse(good).success).toBe(true);
  });
  it('rejects missing, dev- and Cloudflare test secrets', () => {
    expect(schema.safeParse({ ...good, API_PROXY_SECRET: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...good, WEB_URL: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...good, REVALIDATE_SECRET: 'dev-x' }).success).toBe(false);
    expect(
      schema.safeParse({ ...good, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...good, TURNSTILE_SECRET_KEY: '3x00000000000000000000FF' }).success,
    ).toBe(false);
  });
  it('does not require them outside production', () => {
    expect(schema.safeParse({}).success).toBe(true);
  });
});
