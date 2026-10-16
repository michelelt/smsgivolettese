import { z } from "zod";

const schema = z.object({
  url: z.url(),
  key: z.string().min(1),
});

export const supabaseEnv = () =>
  schema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
