import { env } from '../config/env.js';
import { log } from './logger.js';

/** Asks the web app to revalidate ISR tags. Never throws: a failed write-side hook must not fail the write. */
export async function revalidate(tags: string[]): Promise<void> {
  if (!env.WEB_URL || !env.REVALIDATE_SECRET) return log('warn', 'revalidate not configured');
  try {
    const res = await fetch(`${env.WEB_URL}/hooks/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': env.REVALIDATE_SECRET },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) log('warn', 'revalidate failed', { status: res.status });
  } catch {
    log('warn', 'revalidate failed', { tags });
  }
}
