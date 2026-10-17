import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { db, type Tx } from '../../lib/db.js';
import { Conflict, DomainError, Unprocessable, ValidationError } from '../../lib/errors.js';
import { containsPattern, offsetOf } from '../../lib/pagination.js';
import { romeToday } from '../../lib/dates.js';
import { revalidate } from '../../lib/revalidate.js';
import { excerptOf, mediaPaths, normalizeVideos, type Block } from './blocks.js';
import * as repo from './posts.repo.js';
import type { Media } from '../media/media.schemas.js';
import type { PostRow } from './posts.repo.js';
import type { PostCreate, PostPatch, StaffPostsQuery } from './posts.schemas.js';

export const postNotFound = () => new DomainError(404, 'POST_NOT_FOUND', 'Articolo non trovato');
const invalidTransition = (m: string) => new Conflict(m, 'POST_INVALID_TRANSITION');
const tags = (slug: string) => ['posts', `post:${slug}`];

/** Title -> URL slug: NFD, strip diacritics, [^a-z0-9]+ -> "-", at most `max` chars. */
export function slugify(title: string, max = 80): string {
  const s = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, max)
    .replace(/^-+|-+$/g, '');
  return s || 'articolo';
}

/** First free slug: base, base-2, base-3 ... (suffix fits inside the 80 chars limit). */
export async function freeSlug(tx: Tx, title: string, selfId: string | null) {
  for (let n = 1; n <= 100; n++) {
    const suffix = n === 1 ? '' : `-${n}`;
    const slug = slugify(title, 80 - suffix.length) + suffix;
    if (!(await repo.slugTaken(tx, slug, selfId))) return slug;
  }
  throw new Conflict('Impossibile generare un indirizzo univoco');
}

/** A concurrent insert can still win the slug between check and write: retry (the check then sees it). */
export async function retrySlug<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const pg = e as { code?: string; constraint_name?: string };
      if (i >= 3 || pg.code !== '23505' || pg.constraint_name !== 'posts_slug_key') throw e;
    }
  }
}

/** Validated content -> stored form (video ids) + excerpt + referenced media must exist. */
async function prepare(tx: Tx, blocks: Block[], coverMediaId?: string | null) {
  const content = normalizeVideos(blocks);
  const paths = mediaPaths(content);
  const found = await repo.mediaByPaths(tx, paths);
  if (
    found.length !== paths.length ||
    (coverMediaId && !(await repo.mediaExists(tx, coverMediaId)))
  )
    throw new Unprocessable(
      'Uno dei file multimediali non esiste più: caricalo di nuovo',
      'MEDIA_NOT_FOUND',
    );
  return { content, excerpt: excerptOf(content) };
}

/** Row + the media rows its content and cover reference. */
export async function load(tx: Tx, row: PostRow) {
  const paths = [...mediaPaths(row.content), ...(row.cover ? [row.cover.path] : [])];
  return { ...row, media: await repo.mediaByPaths(tx, [...new Set(paths)]) };
}
const loadById = async (tx: Tx, id: string) => {
  const row = await repo.getById(tx, id);
  if (!row) throw postNotFound();
  return load(tx, row);
};

// ---- staff
export const list = (ctx: Ctx, q: z.infer<typeof StaffPostsQuery>) =>
  asUser(ctx, async (tx) => {
    const f = { status: q.status, category: q.category, pattern: q.q && containsPattern(q.q) };
    return {
      items: await repo.listStaff(tx, f, q.pageSize, offsetOf(q)),
      total: await repo.countStaff(tx, f),
    };
  });

export const get = (ctx: Ctx, id: string) => asUser(ctx, (tx) => loadById(tx, id));

export const create = (ctx: Ctx, input: z.infer<typeof PostCreate>) =>
  retrySlug(() =>
    asUser(ctx, async (tx) => {
      const p = await prepare(tx, input.content ?? [], input.coverMediaId);
      const id = await repo.insert(tx, {
        title: input.title,
        category: input.category,
        eventDate: input.eventDate,
        location: input.location,
        coverMediaId: input.coverMediaId,
        content: p.content,
        excerpt: p.excerpt,
        slug: await freeSlug(tx, input.title, null),
        authorId: ctx.user.id,
      });
      return loadById(tx, id);
    }),
  );

export const update = (ctx: Ctx, id: string, input: z.infer<typeof PostPatch>) => {
  if (Object.values(input).every((v) => v === undefined))
    throw new ValidationError('Nessuna modifica');
  return retrySlug(async () => {
    const { post, wasPublished } = await asUser(ctx, async (tx) => {
      const cur = await repo.getById(tx, id, true);
      if (!cur) throw postNotFound();
      const { content, ...rest } = input;
      const row: Record<string, unknown> = { ...rest };
      const p = await prepare(tx, content ?? cur.content, input.coverMediaId);
      if (content) Object.assign(row, { content: p.content, excerpt: p.excerpt });
      // slug follows the title until the first publication, then it is frozen (also by a DB trigger)
      if (cur.publishedAt === null) row.slug = await freeSlug(tx, input.title ?? cur.title, id);
      await repo.update(tx, id, row);
      return { post: await loadById(tx, id), wasPublished: cur.status === 'pubblicata' };
    });
    if (wasPublished) await revalidate(tags(post.slug));
    return post;
  });
};

export const publish = async (ctx: Ctx, id: string) => {
  const post = await asUser(ctx, async (tx) => {
    const cur = await repo.getById(tx, id, true);
    if (!cur) throw postNotFound();
    if (cur.status !== 'bozza') throw invalidTransition("L'articolo è già pubblicato");
    if (cur.category === 'evento' && !cur.eventDate)
      throw new Unprocessable(
        "Indica la data dell'evento prima di pubblicare",
        'EVENT_DATE_REQUIRED',
      );
    await repo.setStatus(tx, id, 'pubblicata');
    if (cur.fromProposalId) await repo.markProposalPublished(tx, cur.fromProposalId, ctx.user.id);
    return loadById(tx, id);
  });
  await revalidate(tags(post.slug));
  return post;
};

export const unpublish = async (ctx: Ctx, id: string) => {
  const post = await asUser(ctx, async (tx) => {
    const cur = await repo.getById(tx, id, true);
    if (!cur) throw postNotFound();
    if (cur.status !== 'pubblicata') throw invalidTransition("L'articolo non è pubblicato");
    await repo.setStatus(tx, id, 'bozza');
    return loadById(tx, id);
  });
  await revalidate(tags(post.slug));
  return post;
};

export const remove = async (ctx: Ctx, id: string) => {
  const cur = await asUser(ctx, async (tx) => {
    const row = await repo.getById(tx, id, true);
    if (!row) throw postNotFound();
    await repo.remove(tx, id);
    return row;
  });
  if (cur.status === 'pubblicata') await revalidate(tags(cur.slug));
};

// ---- public (anon)
const pub = (r: PostRow & { media: Media[] }) => ({
  slug: r.slug,
  title: r.title,
  category: r.category,
  eventDate: r.eventDate,
  location: r.location,
  excerpt: r.excerpt,
  publishedAt: r.publishedAt,
  cover: r.cover,
  content: r.content,
  media: r.media,
});

export async function listPublic(
  q: { category?: string; upcoming?: string; page: number; pageSize: number },
  requestId?: string,
) {
  const f = { category: q.category, upcoming: q.upcoming === 'true', today: romeToday() };
  return db.asAnon(
    async (tx) => ({
      items: await repo.listPublic(tx, f, q.pageSize, offsetOf(q)),
      total: await repo.countPublic(tx, f),
    }),
    requestId,
  );
}

export const getPublic = (slug: string, requestId?: string) =>
  db.asAnon(async (tx) => {
    const row = await repo.getPublicBySlug(tx, slug);
    if (!row) throw postNotFound();
    return pub(await load(tx, row));
  }, requestId);

export const gallery = (q: { page: number; pageSize: number }, requestId?: string) =>
  db.asAnon(
    async (tx) => ({
      items: await repo.gallery(tx, q.pageSize, offsetOf(q)),
      total: await repo.countGallery(tx),
    }),
    requestId,
  );
