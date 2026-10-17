import type { Tx } from '../../lib/db.js';

export type ProposalRow = {
  id: string;
  title: string;
  category: 'evento' | 'avviso' | 'notizia';
  eventDate: string | null;
  status: 'attesa' | 'pubblicata' | 'rifiutata';
  submitterName: string;
  createdAt: string;
  hasPhoto: boolean;
  postId: string | null;
  location: string | null;
  body: string;
  videoUrl: string | null;
  submitterContact: string | null;
  reviewedAt: string | null;
  photoPath: string | null;
};

const COLS = (tx: Tx) => tx`id, title, category, event_date::text as "eventDate", status,
  submitter_name as "submitterName", created_at as "createdAt", photo_path is not null as "hasPhoto",
  post_id as "postId", location, body, video_url as "videoUrl",
  submitter_contact as "submitterContact", reviewed_at as "reviewedAt", photo_path as "photoPath"`;
const where = (tx: Tx, status: string) =>
  status === 'tutte' ? tx`` : tx`where status = ${status}`;

export const list = (tx: Tx, status: string, limit: number, offset: number) =>
  tx<ProposalRow[]>`select ${COLS(tx)} from public.post_proposals ${where(tx, status)}
    order by created_at desc limit ${limit} offset ${offset}`;
export const count = async (tx: Tx, status: string) =>
  (
    await tx<
      { n: number }[]
    >`select count(*)::int as n from public.post_proposals ${where(tx, status)}`
  )[0]!.n;

export const getById = async (tx: Tx, id: string, lock = false) =>
  (
    await tx<ProposalRow[]>`select ${COLS(tx)} from public.post_proposals where id = ${id}
      ${lock ? tx`for update` : tx``}`
  )[0];

export const setPost = (tx: Tx, id: string, postId: string) =>
  tx`update public.post_proposals set post_id = ${postId} where id = ${id}`;
/** Draft post of a proposal with its cover; the media row is returned only when no other post uses it. */
export const draftPost = async (tx: Tx, postId: string) =>
  (
    await tx<{ status: string; mediaId: string | null; mediaPath: string | null }[]>`
      select p.status, m.id as "mediaId", m.path as "mediaPath"
      from public.posts p left join public.media m on m.id = p.cover_media_id
        and not exists (select 1 from public.posts o where o.cover_media_id = m.id and o.id <> p.id)
      where p.id = ${postId} for update of p`
  )[0];
export const deleteDraft = async (tx: Tx, postId: string, mediaId: string | null) => {
  await tx`delete from public.posts where id = ${postId}`;
  if (mediaId) await tx`delete from public.media where id = ${mediaId}`;
};
export const reject = (tx: Tx, id: string, userId: string) =>
  tx`update public.post_proposals set status = 'rifiutata', reviewed_by = ${userId}, reviewed_at = now()
     where id = ${id}`;

export const submit = async (
  tx: Tx,
  i: {
    title: string;
    category: string;
    eventDate?: string;
    location?: string;
    body: string;
    photoPath?: string;
    videoUrl?: string;
    submitterName: string;
    submitterContact?: string;
  },
) =>
  (
    await tx<{ id: string }[]>`
      select public.submit_post_proposal(${i.title}, ${i.category}::public.post_category,
        ${i.eventDate ?? null}::date, ${i.location ?? null}, ${i.body}, ${i.photoPath ?? null},
        ${i.videoUrl ?? null}, ${i.submitterName}, ${i.submitterContact ?? null}) as id`
  )[0]!.id;
