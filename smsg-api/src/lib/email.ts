import { env } from '../config/env.js';
import { log } from './logger.js';

export type Email = { to: string; subject: string; text: string; idempotencyKey?: string };

export const emailEnabled = () => !!(env.RESEND_API_KEY && env.EMAIL_FROM);

/** ADR-057: Resend over plain fetch. Never throws; returns false on failure or when skipped (RESEND_API_KEY/EMAIL_FROM unset, only logs). */
export async function sendEmail(m: Email): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    log('warn', 'email.skipped', { subject: m.subject }); // no address in logs
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
        ...(m.idempotencyKey ? { 'idempotency-key': m.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) log('error', 'email.failed', { status: res.status });
    return res.ok;
  } catch {
    log('error', 'email.failed', { reason: 'network' });
    return false;
  }
}
