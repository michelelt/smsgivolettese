import { z } from 'zod';

// Empty strings (from .env.example) count as unset. Required vars are added per phase.
const opt = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), s.optional());

const schema = z.object({
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: opt(z.string()),
  SUPABASE_URL: opt(z.url()),
  SUPABASE_SECRET_KEY: opt(z.string()),
  TURNSTILE_SECRET_KEY: opt(z.string()),
  RESEND_API_KEY: opt(z.string()),
  EMAIL_FROM: opt(z.string()),
  CRON_SECRET: opt(z.string()),
  REVALIDATE_SECRET: opt(z.string()),
  WEB_URL: opt(z.url()),
});

export const env = schema.parse(process.env);
