import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** ADR-040: x-client-ip is trusted only with the shared proxy secret. */
export function clientIp(h: (name: string) => string | undefined): string {
  const secret = env.API_PROXY_SECRET;
  const given = h('x-proxy-secret');
  if (secret && given && timingSafeEqual(digest(given), digest(secret))) {
    const ip = h('x-client-ip')?.trim();
    if (ip) return ip;
  }
  return h('x-real-ip')?.trim() || h('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
