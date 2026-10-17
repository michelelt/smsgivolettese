import { randomUUID } from 'node:crypto';
import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { db } from '../../lib/db.js';
import { Unprocessable, ValidationError } from '../../lib/errors.js';
import { objectInfo, removeObjects, signedUpload } from '../../lib/storage.js';
import * as repo from './media.repo.js';
import { extMatches, MIME_EXT, type CompleteBody, type UploadUrlBody } from './media.schemas.js';

const IMAGE_MAX_MB = 10;

/** Limit in bytes for a kind; the video limit lives in org_settings (read as service, staff cannot select it). */
async function limit(kind: 'image' | 'video', requestId?: string) {
  const mb =
    kind === 'image' ? IMAGE_MAX_MB : await db.asService((tx) => repo.videoMaxMb(tx), requestId);
  return { mb, bytes: mb * 1024 * 1024 };
}
const tooLarge = (kind: 'image' | 'video', mb: number) =>
  new Unprocessable(
    kind === 'image'
      ? `L'immagine supera il limite di ${mb} MB`
      : `Il video supera il limite di ${mb} MB: caricalo su YouTube e incolla il link`,
    'FILE_TOO_LARGE',
    { maxMb: mb },
  );

export async function uploadUrl(ctx: Ctx, input: z.infer<typeof UploadUrlBody>) {
  if (input.mime.startsWith('video/') !== (input.kind === 'video'))
    throw new ValidationError('Formato non supportato per questo tipo di file');
  const max = await limit(input.kind, ctx.requestId);
  if (input.size > max.bytes) throw tooLarge(input.kind, max.mb);
  return signedUpload(
    'media',
    `${new Date().getUTCFullYear()}/${randomUUID()}.${MIME_EXT[input.mime]}`,
  );
}

export async function complete(ctx: Ctx, input: z.infer<typeof CompleteBody>) {
  const info = await objectInfo('media', input.path);
  if (!info) throw new Unprocessable('Il file non risulta caricato: riprova', 'UPLOAD_NOT_FOUND');
  const kind = info.mime.startsWith('video/') ? 'video' : 'image';
  const max = await limit(kind, ctx.requestId);
  if (
    !extMatches(info.mime, input.path.split('.').pop()!) ||
    info.size > max.bytes ||
    info.size < 1
  ) {
    await removeObjects('media', [input.path]);
    throw new Unprocessable(
      'Il file non è valido: formato o dimensione non consentiti',
      'UPLOAD_INVALID',
    );
  }
  return asUser(ctx, (tx) =>
    repo.insert(tx, { ...input, mime: info.mime, size: info.size, uploadedBy: ctx.user.id }),
  );
}
