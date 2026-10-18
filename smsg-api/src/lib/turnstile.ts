import { env } from '../config/env.js';
import { log } from './logger.js';

let warned = false;

/** Without TURNSTILE_SECRET_KEY the check is off (per-IP rate limit only). With it, fails closed: empty token, timeout, network error or non-success. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (!warned) log('warn', 'turnstile disabled: TURNSTILE_SECRET_KEY not set');
    warned = true;
    return true;
  }
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(ip === 'local' ? {} : { remoteip: ip }), // 'local' is the client-ip fallback, not an IP
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const r = (await res.json()) as { success?: boolean; hostname?: string };
    if (r.success !== true) return false;
    // test keys return a dummy hostname, so only enforce in production
    if (env.NODE_ENV === 'production') {
      return !!env.WEB_URL && r.hostname === new URL(env.WEB_URL).hostname;
    }
    return true;
  } catch {
    log('warn', 'turnstile unreachable');
    return false;
  }
}
