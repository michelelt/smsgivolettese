import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    API_URL: z.url().optional(),
  })
  .transform((e, ctx) => {
    if (e.API_URL) return { API_URL: e.API_URL };
    if (e.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["API_URL"],
        message: "API_URL is required in production",
      });
      return z.NEVER;
    }
    return { API_URL: "http://localhost:3001" };
  });

export const parseEnv = (env: Record<string, string | undefined>) =>
  envSchema.parse(env);
