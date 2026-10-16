import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { parseEnv } from "@/lib/env";

const body = z.object({
  tags: z
    .array(z.string().regex(/^[a-z0-9:_-]{1,100}$/))
    .min(1)
    .max(50),
});

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function POST(request: Request) {
  const given = request.headers.get("x-revalidate-secret") ?? "";
  // Hash both sides so lengths match and timing leaks nothing about the secret.
  if (
    !timingSafeEqual(
      digest(given),
      digest(parseEnv(process.env).REVALIDATE_SECRET),
    )
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Invalid body" }, { status: 400 });

  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: parsed.data.tags });
}
