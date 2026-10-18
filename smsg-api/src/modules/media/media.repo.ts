import type { Tx } from '../../lib/db.js';
import type { Media } from './media.schemas.js';

export const insert = async (
  tx: Tx,
  m: {
    path: string;
    mime: string;
    size: number;
    width?: number;
    height?: number;
    alt?: string;
    uploadedBy: string;
  },
) =>
  (
    await tx<Media[]>`
      insert into public.media (bucket, path, mime, size_bytes, width, height, alt, uploaded_by)
      values ('media', ${m.path}, ${m.mime}, ${m.size}, ${m.width ?? null}, ${m.height ?? null},
              ${m.alt ?? null}, ${m.uploadedBy})
      returning id, path, mime, width, height, alt`
  )[0]!;

export const videoMaxMb = async (tx: Tx) =>
  (await tx<{ mb: number }[]>`select video_max_mb as mb from public.org_settings`)[0]!.mb;
