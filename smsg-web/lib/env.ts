import { z } from "zod";

const opt = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), s.optional());

const DEV = {
  API_URL: "http://localhost:3001",
  API_PROXY_SECRET: "dev-proxy-secret",
  REVALIDATE_SECRET: "dev-revalidate-secret",
  SITE_URL: "http://localhost:3000",
};

const TEST_SITE_KEY = /^[123]x0{20}AA$/;

export const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    API_URL: opt(z.url()),
    API_PROXY_SECRET: opt(z.string().min(16)),
    REVALIDATE_SECRET: opt(z.string().min(16)),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: opt(z.string()),
    SITE_URL: opt(z.url()),
  })
  .transform((e, ctx) => {
    // Turnstile is optional: unset in production means no widget, no token.
    const out = {
      ...DEV,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: (e.NODE_ENV === "production"
        ? undefined
        : "1x00000000000000000000AA") as string | undefined,
    };
    if (e.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
      out.NEXT_PUBLIC_TURNSTILE_SITE_KEY = e.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    for (const k of Object.keys(DEV) as (keyof typeof DEV)[]) {
      if (e[k]) out[k] = e[k];
      else if (e.NODE_ENV === "production") {
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: `${k} is required in production`,
        });
      }
    }
    if (e.NODE_ENV === "production") {
      const bad = (k: keyof typeof out, message: string) =>
        ctx.addIssue({ code: "custom", path: [k], message });
      for (const k of ["API_PROXY_SECRET", "REVALIDATE_SECRET"] as const)
        if (out[k].startsWith("dev-")) bad(k, `${k} must not be a dev value`);
      if (TEST_SITE_KEY.test(out.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""))
        bad(
          "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
          "Turnstile test key in production",
        );
      if (out.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.startsWith("dev-"))
        bad(
          "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
          "Turnstile dev value in production",
        );
    }
    return out;
  });

export const parseEnv = (env: Record<string, string | undefined>) =>
  envSchema.parse(env);
