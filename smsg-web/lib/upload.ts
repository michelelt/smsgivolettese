import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image-resize";

export type MediaRow = NonNullable<components["schemas"]["Media"]>;
type Mime = components["schemas"]["MediaUploadUrlBody"]["mime"];

/** Staff upload (ADR-062): resize images → upload-url → direct Storage upload → complete. */
export async function uploadMedia(
  file: File,
  kind: "image" | "video",
  alt?: string,
): Promise<MediaRow> {
  let body: Blob = file;
  let mime = file.type as Mime;
  let dims: { width?: number; height?: number } = {};
  if (kind === "image") {
    const r = await resizeImage(file);
    body = r.blob;
    mime = r.mime;
    dims = { width: r.width, height: r.height };
  }
  const target = await call(
    api.POST("/media/upload-url", { body: { kind, mime, size: body.size } }),
  );
  const { error } = await createClient()
    .storage.from(target.bucket)
    .uploadToSignedUrl(target.path, target.token, body, { contentType: mime });
  if (error) throw new Error("Caricamento non riuscito. Riprova.");
  const m = await call(
    api.POST("/media/complete", {
      body: {
        path: target.path,
        ...dims,
        ...(alt?.trim() ? { alt: alt.trim() } : {}),
      },
    }),
  );
  if (!m) throw new Error("Caricamento non riuscito. Riprova.");
  return m;
}
