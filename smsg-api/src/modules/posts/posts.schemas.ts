import { z } from '@hono/zod-openapi';
import { PageQuery, pageOf } from '../../lib/pagination.js';
import { Media } from '../media/media.schemas.js';
import { Blocks } from './blocks.js';

export const PostCategory = z.enum(['evento', 'avviso', 'notizia']).openapi('PostCategory');
const date = z.iso.date();
const title = z.string().trim().min(1).max(200);
const location = z.string().trim().min(1).max(200);

const common = {
  slug: z.string(),
  title: z.string(),
  category: PostCategory,
  eventDate: z.string().nullable(),
  location: z.string().nullable(),
  excerpt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  cover: Media.nullable(),
};

export const PublicPostItem = z.object(common).openapi('PublicPostItem');
export const PublicPostList = pageOf(PublicPostItem).openapi('PublicPostList');
export const PublicPost = z
  .object({ ...common, content: Blocks, media: z.array(Media) })
  .openapi('PublicPost');
export const GalleryItem = z
  .object({
    slug: z.string(),
    title: z.string(),
    publishedAt: z.string().nullable(),
    cover: Media,
  })
  .openapi('GalleryItem');
export const GalleryList = pageOf(GalleryItem).openapi('GalleryList');

export const PublicPostsQuery = z.object({
  category: PostCategory.optional(),
  upcoming: z.enum(['true', 'false']).optional(),
  page: PageQuery.shape.page,
  pageSize: z.coerce.number().int().min(1).max(24).default(10),
});
export const GalleryQuery = PublicPostsQuery.pick({ page: true, pageSize: true });
export const SlugParam = z.object({ slug: z.string().min(1).max(80) });

const staffCommon = {
  ...common,
  id: z.uuid(),
  status: z.enum(['bozza', 'pubblicata']),
  updatedAt: z.string(),
  fromProposalId: z.uuid().nullable(),
};
export const StaffPostItem = z.object(staffCommon).openapi('StaffPostItem');
export const StaffPostList = pageOf(StaffPostItem).openapi('StaffPostList');
export const StaffPost = z
  .object({ ...staffCommon, content: Blocks, media: z.array(Media) })
  .openapi('StaffPost');
export type StaffPost = z.infer<typeof StaffPost>;

export const StaffPostsQuery = PageQuery.extend({
  status: z.enum(['bozza', 'pubblicata', 'tutte']).default('tutte'),
  category: PostCategory.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const PostCreate = z
  .strictObject({
    title,
    category: PostCategory,
    eventDate: date.optional(),
    location: location.optional(),
    coverMediaId: z.uuid().optional(),
    content: Blocks.optional(),
  })
  .openapi('PostCreate');
export const PostPatch = z
  .strictObject({
    title,
    category: PostCategory,
    eventDate: date.nullable(),
    location: location.nullable(),
    coverMediaId: z.uuid().nullable(),
    content: Blocks,
  })
  .partial()
  .openapi('PostPatch');
