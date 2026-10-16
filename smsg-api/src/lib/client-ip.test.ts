import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.API_PROXY_SECRET = 'proxy-secret-for-test';
});
import { clientIp } from './client-ip.js';

const ip = (h: Record<string, string>) => clientIp((n) => h[n]);

describe('clientIp', () => {
  it('trusts x-client-ip only with the matching secret', () => {
    expect(
      ip({
        'x-client-ip': '1.1.1.1',
        'x-proxy-secret': 'proxy-secret-for-test',
        'x-real-ip': '9.9.9.9',
      }),
    ).toBe('1.1.1.1');
    expect(
      ip({ 'x-client-ip': '1.1.1.1', 'x-proxy-secret': 'wrong', 'x-real-ip': '9.9.9.9' }),
    ).toBe('9.9.9.9');
    expect(ip({ 'x-client-ip': '1.1.1.1', 'x-real-ip': '9.9.9.9' })).toBe('9.9.9.9');
  });
  it('falls back to first x-forwarded-for, then a fixed key', () => {
    expect(ip({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' })).toBe('2.2.2.2');
    expect(ip({})).toBe('local');
  });
});
