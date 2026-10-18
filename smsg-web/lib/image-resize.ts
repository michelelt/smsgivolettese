export const MAX_SIDE = 2000;

/** Scale down so the long side is ≤ max; never upscale. */
export function fitSize(w: number, h: number, max = MAX_SIDE) {
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((r) => c.toBlob(r, type, q));

export type Resized = {
  blob: Blob;
  mime: "image/webp" | "image/jpeg";
  width: number;
  height: number;
};

/** Browser-side resize (ADR-062): WebP 0.82, JPEG when the browser cannot encode WebP. */
export async function resizeImage(file: File): Promise<Resized> {
  const bmp = await createImageBitmap(file);
  const { width, height } = fitSize(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile");
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  // Unsupported WebP makes toBlob silently return PNG: check the type.
  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp?.type === "image/webp")
    return { blob: webp, mime: "image/webp", width, height };
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("Impossibile preparare la foto");
  return { blob: jpeg, mime: "image/jpeg", width, height };
}
