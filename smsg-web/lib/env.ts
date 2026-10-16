import { z } from "zod";

const opt = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), s.optional());

const DEV = {
  API_URL: "http://localhost:3001",
  API_PROXY_SECRET: "dev-proxy-secret",
  REVALIDATE_SECRET: "dev-revalidate-secret",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
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
    const out = { ...DEV };
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
      const bad = (k: keyof typeof DEV, message: string) =>
        ctx.addIssue({ code: "custom", path: [k], message });
      for (const k of ["API_PROXY_SECRET", "REVALIDATE_SECRET"] as const)
        if (out[k].startsWith("dev-")) bad(k, `${k} must not be a dev value`);
      if (TEST_SITE_KEY.test(out.NEXT_PUBLIC_TURNSTILE_SITE_KEY))
        bad(
          "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
          "Turnstile test key in production",
        );
    }
    return out;
  });

export const parseEnv = (env: Record<string, string | undefined>) =>
  envSchema.parse(env);
