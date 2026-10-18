import { z } from '@hono/zod-openapi';
import { MediaPath } from '../posts/blocks.js';

export const MIME_EXT = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;
export type Mime = keyof typeof MIME_EXT;
export const MIMES = Object.keys(MIME_EXT) as [Mime, ...Mime[]];
/** The path extension must match the real mime (jpeg is an alias of jpg). */
export const extMatches = (mime: string, ext: string) =>
  MIME_EXT[mime as Mime] === (ext === 'jpeg' ? 'jpg' : ext);

export const Media = z
  .object({
    id: z.uuid(),
    path: z.string(),
    mime: z.string(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    alt: z.string().nullable(),
  })
  .openapi('Media');
export type Media = z.infer<typeof Media>;

export const UploadUrlBody = z
  .strictObject({
    kind: z.enum(['image', 'video']),
    mime: z.enum(MIMES),
    size: z.number().int().min(1),
  })
  .openapi('MediaUploadUrlBody');

export const UploadTarget = z
  .object({ bucket: z.string(), path: z.string(), token: z.string(), signedUrl: z.string() })
  .openapi('UploadTarget');

export const CompleteBody = z
  .strictObject({
    path: MediaPath,
    width: z.number().int().min(1).max(20000).optional(),
    height: z.number().int().min(1).max(20000).optional(),
    alt: z.string().trim().max(300).optional(),
  })
  .openapi('MediaCompleteBody');
