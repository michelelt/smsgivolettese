import { z } from 'zod';

// Empty strings (from .env.example) count as unset. Required vars are added per phase.
const opt = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), s.optional());

export const schema = z
  .object({
    NODE_ENV: opt(z.string()),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    DATABASE_URL: opt(z.string()),
    SUPABASE_URL: opt(z.url()),
    SUPABASE_SECRET_KEY: opt(z.string()),
    TURNSTILE_SECRET_KEY: opt(z.string()),
    RESEND_API_KEY: opt(z.string()),
    EMAIL_FROM: opt(z.string()),
    CRON_SECRET: opt(z.string().min(16)),
    REVALIDATE_SECRET: opt(z.string().min(16)),
    WEB_URL: opt(z.url()),
    API_PROXY_SECRET: opt(z.string().min(16)),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== 'production') return;
    // Turnstile hostname check and revalidation need it; without it every booking fails closed
    if (!e.WEB_URL)
      ctx.addIssue({ code: 'custom', path: ['WEB_URL'], message: 'required in production' });
    for (const k of ['RESEND_API_KEY', 'EMAIL_FROM', 'CRON_SECRET'] as const)
      if (!e[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'required in production' });
    for (const k of ['API_PROXY_SECRET', 'REVALIDATE_SECRET', 'TURNSTILE_SECRET_KEY'] as const) {
      const v = e[k];
      // dev- placeholders and Cloudflare dummy keys (1x0000..., 2x0000..., 3x0000...) must never reach prod
      if (!v || v.startsWith('dev-') || /^[123]x0000/.test(v)) {
        ctx.addIssue({
          code: 'custom',
          path: [k],
          message: 'missing or development value in production',
        });
      }
    }
  });

export const env = schema.parse(process.env);
