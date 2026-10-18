import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { sendEmail } from '../../lib/email.js';
import { validSecret } from '../cron/cron.service.js';
import * as t from './templates.js';

afterEach(() => {
  vi.unstubAllGlobals();
  env.RESEND_API_KEY = undefined;
  env.EMAIL_FROM = undefined;
  env.CRON_SECRET = undefined;
});

describe('templates', () => {
  const item = { label: 'Segreteria', day: '2026-10-19', time: '09:00–11:00' };
  it('say type, date, time and link only', () => {
    const m = t.assigned(item);
    expect(m.text).toContain('Segreteria, 19/10/2026, 09:00–11:00');
    expect(m.text).toContain('/gestione');
    expect(t.reminder([item, item]).text).toContain('questi impegni');
    expect(t.refused('Mario Rossi', item).text).toContain('Mario Rossi ha rifiutato');
  });
});

describe('sendEmail', () => {
  it('skips (returns false) without a key', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await sendEmail({ to: 'a@b.it', subject: 's', text: 't' })).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('posts to Resend with the idempotency key and never throws', async () => {
    env.RESEND_API_KEY = 're_x';
    env.EMAIL_FROM = 'SMS <n@x.it>';
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    expect(await sendEmail({ to: 'a@b.it', subject: 's', text: 't', idempotencyKey: 'k' })).toBe(
      true,
    );
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('k');
    vi.stubGlobal('fetch', async () => {
      throw new Error('down');
    });
    expect(await sendEmail({ to: 'a@b.it', subject: 's', text: 't' })).toBe(false);
  });
});

describe('cron secret', () => {
  it('accepts only the exact bearer secret', () => {
    expect(validSecret('Bearer x')).toBe(false); // unset
    env.CRON_SECRET = 'a-long-enough-secret';
    expect(validSecret('Bearer a-long-enough-secret')).toBe(true);
    expect(validSecret('Bearer a-long-enough-secreT')).toBe(false);
    expect(validSecret('a-long-enough-secret')).toBe(false);
    expect(validSecret(undefined)).toBe(false);
  });
});
