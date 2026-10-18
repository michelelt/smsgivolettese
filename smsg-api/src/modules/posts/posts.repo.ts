import type { Tx } from '../../lib/db.js';
import type { Media } from '../media/media.schemas.js';
import { toRow } from '../../lib/sql.js';
import type { Block } from './blocks.js';

export type PostRow = {
  id: string;
  slug: string;
  title: string;
  category: 'evento' | 'avviso' | 'notizia';
  status: 'bozza' | 'pubblicata';
  eventDate: string | null;
  location: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  fromProposalId: string | null;
  cover: Media | null;
  content: Block[];
};

const FROM = (tx: Tx) =>
  tx`from public.posts p left join public.media m on m.id = p.cover_media_id`;
const COLS = (tx: Tx, content: boolean) => tx`
  p.id, p.slug, p.title, p.category, p.status, p.event_date::text as "eventDate", p.location,
  p.excerpt, p.published_at as "publishedAt", p.updated_at as "updatedAt",
  p.from_proposal_id as "fromProposalId",
  case when m.id is null then null else json_build_object('id', m.id, 'path', m.path,
    'mime', m.mime, 'width', m.width, 'height', m.height, 'alt', m.alt) end as cover
  ${content ? tx`, p.content` : tx``}`;

export type StaffFilter = {
  status: 'bozza' | 'pubblicata' | 'tutte';
  category?: string;
  q?: string;
  pattern?: string;
};
const staffWhere = (tx: Tx, f: StaffFilter) => tx`where true
  ${f.status === 'tutte' ? tx`` : tx`and p.status = ${f.status}`}
  ${f.category ? tx`and p.category = ${f.category}` : tx``}
  ${f.pattern ? tx`and p.title ilike ${f.pattern}` : tx``}`;

export const listStaff = (tx: Tx, f: StaffFilter, limit: number, offset: number) =>
  tx<Omit<PostRow, 'content'>[]>`select ${COLS(tx, false)} ${FROM(tx)} ${staffWhere(tx, f)}
    order by p.updated_at desc limit ${limit} offset ${offset}`;
export const countStaff = async (tx: Tx, f: StaffFilter) =>
  (
    await tx<{ n: number }[]>`select count(*)::int as n from public.posts p ${staffWhere(tx, f)}`
  )[0]!.n;

export const getById = async (tx: Tx, id: string, lock = false) =>
  (
    await tx<PostRow[]>`select ${COLS(tx, true)} ${FROM(tx)} where p.id = ${id}
      ${lock ? tx`for update of p` : tx``}`
  )[0];

const COL_MAP = {
  title: 'title',
  category: 'category',
  eventDate: 'event_date',
  location: 'location',
  coverMediaId: 'cover_media_id',
  excerpt: 'excerpt',
  slug: 'slug',
  authorId: 'author_id',
  fromProposalId: 'from_proposal_id',
};
type Write = { content?: Block[] } & Record<string, unknown>;
const row = (tx: Tx, input: Write) => {
  const { content, ...rest } = input;
  return {
    ...toRow(rest, COL_MAP),
    ...(content === undefined ? {} : { content: tx.json(content as never) }),
  } as Record<string, never>;
};
export const insert = async (tx: Tx, input: Write) =>
  (await tx<{ id: string }[]>`insert into public.posts ${tx(row(tx, input))} returning id`)[0]!.id;
export const update = (tx: Tx, id: string, input: Write) =>
  tx`update public.posts set ${tx(row(tx, input))}, updated_at = now() where id = ${id}`;

export const slugTaken = async (tx: Tx, slug: string, selfId: string | null) =>
  (
    await tx`select 1 from public.posts where slug = ${slug} and id is distinct from ${selfId}::uuid`
  ).length > 0;

export const setStatus = (tx: Tx, id: string, status: 'bozza' | 'pubblicata') =>
  tx`update public.posts set status = ${status},
       published_at = case when ${status} = 'pubblicata' then coalesce(published_at, now()) else published_at end,
       updated_at = now()
     where id = ${id}`;

export const remove = (tx: Tx, id: string) => tx`delete from public.posts where id = ${id}`;

export const markProposalPublished = (tx: Tx, proposalId: string, userId: string) =>
  tx`update public.post_proposals set status = 'pubblicata', reviewed_by = ${userId}, reviewed_at = now()
     where id = ${proposalId} and status = 'attesa'`;

export const mediaByPaths = (tx: Tx, paths: string[]) =>
  paths.length
    ? tx<Media[]>`select id, path, mime, width, height, alt from public.media
        where bucket = 'media' and path in ${tx(paths)}`
    : Promise.resolve([] as Media[]);
export const mediaExists = async (tx: Tx, id: string) =>
  (await tx`select 1 from public.media where id = ${id} and bucket = 'media'`).length > 0;

// Public (anon, RLS: published only)
export type PublicFilter = { category?: string; upcoming: boolean; today: string };
const pubWhere = (tx: Tx, f: PublicFilter) => tx`where true
  ${f.category ? tx`and p.category = ${f.category}` : tx``}
  ${f.upcoming ? tx`and p.category = 'evento' and p.event_date >= ${f.today}::date` : tx``}`;
export const listPublic = (tx: Tx, f: PublicFilter, limit: number, offset: number) =>
  tx<Omit<PostRow, 'content' | 'id' | 'status' | 'updatedAt' | 'fromProposalId'>[]>`
    select ${COLS(tx, false)} ${FROM(tx)} ${pubWhere(tx, f)}
    order by ${f.upcoming ? tx`p.event_date asc, p.published_at desc` : tx`p.published_at desc`}
    limit ${limit} offset ${offset}`;
export const countPublic = async (tx: Tx, f: PublicFilter) =>
  (await tx<{ n: number }[]>`select count(*)::int as n from public.posts p ${pubWhere(tx, f)}`)[0]!
    .n;
export const getPublicBySlug = async (tx: Tx, slug: string) =>
  (await tx<PostRow[]>`select ${COLS(tx, true)} ${FROM(tx)} where p.slug = ${slug}`)[0];
export const gallery = (tx: Tx, limit: number, offset: number) =>
  tx<
    { slug: string; title: string; publishedAt: string | null; cover: Media }[]
  >`select p.slug, p.title, p.published_at as "publishedAt",
       json_build_object('id', m.id, 'path', m.path, 'mime', m.mime, 'width', m.width,
         'height', m.height, 'alt', m.alt) as cover
     from public.posts p join public.media m on m.id = p.cover_media_id
     order by p.published_at desc limit ${limit} offset ${offset}`;
export const countGallery = async (tx: Tx) =>
  (
    await tx<
      { n: number }[]
    >`select count(*)::int as n from public.posts where cover_media_id is not null`
  )[0]!.n;
