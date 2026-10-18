import { describe, expect, it } from 'vitest';
import { schema } from './env.js';

const good = {
  NODE_ENV: 'production',
  API_PROXY_SECRET: 'prod-proxy-secret-0123',
  REVALIDATE_SECRET: 'prod-revalidate-secret-0123',
  TURNSTILE_SECRET_KEY: '0x4AAAA',
  WEB_URL: 'https://example.org',
  RESEND_API_KEY: 're_123',
  EMAIL_FROM: 'SMS <noreply@example.org>',
  CRON_SECRET: 'prod-cron-secret-0123',
  SUPERADMIN_MFA: 'required',
};

describe('env in production', () => {
  it('accepts real secrets', () => {
    expect(schema.safeParse(good).success).toBe(true);
  });
  it('rejects missing, dev- and Cloudflare test secrets', () => {
    expect(schema.safeParse({ ...good, API_PROXY_SECRET: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...good, WEB_URL: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...good, SUPERADMIN_MFA: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...good, SUPERADMIN_MFA: 'maybe' }).success).toBe(false);
    expect(schema.safeParse({ ...good, CRON_SECRET: undefined }).success).toBe(false);
    expect(schema.safeParse({ ...good, REVALIDATE_SECRET: 'dev-x' }).success).toBe(false);
    expect(
      schema.safeParse({ ...good, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...good, TURNSTILE_SECRET_KEY: '3x00000000000000000000FF' }).success,
    ).toBe(false);
  });
  it('Turnstile, Resend and EMAIL_FROM are optional in production', () => {
    for (const k of ['TURNSTILE_SECRET_KEY', 'RESEND_API_KEY', 'EMAIL_FROM'])
      expect(schema.safeParse({ ...good, [k]: undefined }).success).toBe(true);
  });
  it('does not require them outside production', () => {
    expect(schema.safeParse({}).success).toBe(true);
  });
});
