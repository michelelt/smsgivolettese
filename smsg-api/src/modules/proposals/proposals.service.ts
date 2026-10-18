import { randomUUID } from 'node:crypto';
import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { db } from '../../lib/db.js';
import {
  DomainError,
  Conflict,
  RateLimited,
  TurnstileFailed,
  Unprocessable,
} from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import {
  copyObject,
  objectInfo,
  removeObjects,
  signedReadUrl,
  signedUpload,
} from '../../lib/storage.js';
import { verifyTurnstile } from '../../lib/turnstile.js';
import * as mediaRepo from '../media/media.repo.js';
import { MIME_EXT, type Mime } from '../media/media.schemas.js';
import { Blocks, excerptOf, parseVideoUrl, type Block } from '../posts/blocks.js';
import * as postsRepo from '../posts/posts.repo.js';
import * as posts from '../posts/posts.service.js';
import { consumeRateLimit } from '../public/public.repo.js';
import * as repo from './proposals.repo.js';
import type { ProposalRow } from './proposals.repo.js';
import {
  PHOTO_MAX_BYTES,
  PROPOSAL_MIMES,
  type ProposalSubmit,
  type ProposalsQuery,
  type ProposalUploadBody,
} from './proposals.schemas.js';

const notFound = () => new DomainError(404, 'PROPOSAL_NOT_FOUND', 'Proposta non trovata');
const invalid = () =>
  new Conflict('La proposta è già stata gestita', 'PROPOSAL_INVALID_TRANSITION');

// ---- staff
export const list = (ctx: Ctx, q: z.infer<typeof ProposalsQuery>) =>
  asUser(ctx, async (tx) => ({
    items: await repo.list(tx, q.status, q.pageSize, offsetOf(q)),
    total: await repo.count(tx, q.status),
  }));

export async function get(ctx: Ctx, id: string) {
  const p = await asUser(ctx, (tx) => repo.getById(tx, id));
  if (!p) throw notFound();
  const photoUrl =
    p.photoPath && p.status !== 'rifiutata'
      ? await signedReadUrl('proposals', p.photoPath, 600)
      : null;
  return { ...p, photoUrl };
}

const text = (t: string): Block => ({
  id: randomUUID(),
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text: t, styles: {} }],
  children: [],
});

/** Proposal -> BlockNote content: paragraphs from blank lines, image, video (or a link button). */
export function proposalBlocks(
  p: Pick<ProposalRow, 'body' | 'videoUrl'>,
  imagePath?: string,
): Block[] {
  const blocks: Block[] = p.body
    .split(/\n\s*\n/)
    .map((s) => s.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map(text);
  if (imagePath)
    blocks.push({
      id: randomUUID(),
      type: 'image',
      props: { url: imagePath, caption: '' },
      children: [],
    });
  if (p.videoUrl) {
    const v = parseVideoUrl(p.videoUrl);
    blocks.push(
      v
        ? { id: randomUUID(), type: 'video', props: { ...v, caption: '' }, children: [] }
        : {
            id: randomUUID(),
            type: 'buttonLink',
            props: { label: 'Guarda il video', href: p.videoUrl },
            children: [],
          },
    );
  }
  return Blocks.parse(blocks);
}

async function draftOf(ctx: Ctx, id: string): Promise<{ postId: string; created: boolean }> {
  const p = await asUser(ctx, (tx) => repo.getById(tx, id));
  if (!p) throw notFound();
  if (p.status !== 'attesa') throw invalid();
  if (p.postId) return { postId: p.postId, created: false };

  // Copy outside the DB tx; if the tx loses a race the copy has no media row and the daily cron removes it.
  let photo: { path: string; mime: string; size: number } | undefined;
  const info = p.photoPath ? await objectInfo('proposals', p.photoPath) : null;
  if (p.photoPath && info && info.mime in MIME_EXT && info.mime.startsWith('image/')) {
    const path = `${new Date().getUTCFullYear()}/${randomUUID()}.${MIME_EXT[info.mime as Mime]}`;
    await copyObject(p.photoPath, path, 'proposals', 'media');
    photo = { path, mime: info.mime, size: info.size };
  }

  return posts.retrySlug(() =>
    asUser(ctx, async (tx) => {
      const cur = await repo.getById(tx, id, true);
      if (!cur) throw notFound();
      if (cur.status !== 'attesa') throw invalid();
      if (cur.postId) return { postId: cur.postId, created: false };
      const media = photo && (await mediaRepo.insert(tx, { ...photo, uploadedBy: ctx.user.id }));
      const content = proposalBlocks(cur, media?.path);
      const postId = await postsRepo.insert(tx, {
        title: cur.title,
        category: cur.category,
        eventDate: cur.eventDate ?? undefined,
        location: cur.location ?? undefined,
        coverMediaId: media?.id,
        content,
        excerpt: excerptOf(content),
        slug: await posts.freeSlug(tx, cur.title, null),
        authorId: ctx.user.id,
        fromProposalId: id,
      });
      await repo.setPost(tx, id, postId);
      return { postId, created: true };
    }),
  );
}

export async function draft(ctx: Ctx, id: string) {
  const { postId, created } = await draftOf(ctx, id);
  return { post: await posts.get(ctx, postId), created };
}

export async function publish(ctx: Ctx, id: string) {
  const { postId } = await draftOf(ctx, id);
  return posts.publish(ctx, postId); // marks the proposal pubblicata in the same tx
}

export async function reject(ctx: Ctx, id: string) {
  const p = await asUser(ctx, async (tx) => {
    const cur = await repo.getById(tx, id, true);
    if (!cur) throw notFound();
    if (cur.status !== 'attesa') throw invalid();
    // a draft made from this proposal goes away with it; a published one is a conflict
    const dp = cur.postId ? await repo.draftPost(tx, cur.postId) : undefined;
    if (dp && dp.status !== 'bozza') throw invalid();
    await repo.reject(tx, id, ctx.user.id);
    if (dp && cur.postId) await repo.deleteDraft(tx, cur.postId, dp.mediaId);
    return { ...cur, mediaPath: dp?.mediaPath };
  });
  if (p.photoPath) await removeObjects('proposals', [p.photoPath]);
  if (p.mediaPath) await removeObjects('media', [p.mediaPath]);
  return get(ctx, id);
}

// ---- public (anon)
const tooLarge = () =>
  new Unprocessable('La foto supera il limite di 5 MB', 'FILE_TOO_LARGE', { maxMb: 5 });

export async function uploadUrl(input: z.infer<typeof ProposalUploadBody>, ip: string) {
  if (input.size > PHOTO_MAX_BYTES) throw tooLarge();
  if (!(await consumeRateLimit(`proposal-upload:${ip}`, 5, 3600))) throw new RateLimited();
  return signedUpload('proposals', `${randomUUID()}.${MIME_EXT[input.mime]}`);
}

export async function submit(
  input: z.infer<typeof ProposalSubmit>,
  ip: string,
  requestId?: string,
) {
  if (!(await consumeRateLimit(`proposal:${ip}`, 3, 3600))) throw new RateLimited();
  if (!(await verifyTurnstile(input.turnstileToken, ip))) throw new TurnstileFailed();
  if (input.photoPath) {
    const info = await objectInfo('proposals', input.photoPath);
    if (
      !info ||
      !(PROPOSAL_MIMES as readonly string[]).includes(info.mime) ||
      info.size > PHOTO_MAX_BYTES
    ) {
      if (info) await removeObjects('proposals', [input.photoPath]);
      throw new Unprocessable('La foto non risulta caricata: riprova', 'UPLOAD_NOT_FOUND');
    }
  }
  return { id: await db.asAnon((tx) => repo.submit(tx, input), requestId) };
}
