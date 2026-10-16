import { RateLimited, TurnstileFailed } from '../../lib/errors.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import * as repo from './public.repo.js';
import type { BookingInput } from './public.schemas.js';

export const listServices = repo.listServices;
export const getSiteSettings = repo.getSiteSettings;

/** ADR-039 order: (Zod done by the route) -> rate limit -> Turnstile -> SQL. */
export async function submitBooking(input: BookingInput, ip: string, requestId?: string) {
  if (!(await repo.consumeRateLimit(`booking:${ip}`, 5, 600))) throw new RateLimited();
  if (!(await verifyTurnstile(input.turnstileToken, ip))) throw new TurnstileFailed();
  return { id: await repo.submitBooking(input, requestId) };
}
