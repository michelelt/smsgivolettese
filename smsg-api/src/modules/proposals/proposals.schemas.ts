import { z } from '@hono/zod-openapi';
import { PageQuery, pageOf } from '../../lib/pagination.js';
import { Href } from '../posts/blocks.js';
import { PostCategory } from '../posts/posts.schemas.js';

export const ProposalStatus = z
  .enum(['attesa', 'pubblicata', 'rifiutata'])
  .openapi('ProposalStatus');

const item = {
  id: z.uuid(),
  title: z.string(),
  category: PostCategory,
  eventDate: z.string().nullable(),
  status: ProposalStatus,
  submitterName: z.string(),
  createdAt: z.string(),
  hasPhoto: z.boolean(),
  postId: z.uuid().nullable(),
};
export const ProposalItem = z.object(item).openapi('ProposalItem');
export const ProposalList = pageOf(ProposalItem).openapi('ProposalList');
export const Proposal = z
  .object({
    ...item,
    location: z.string().nullable(),
    body: z.string(),
    videoUrl: z.string().nullable(),
    submitterContact: z.string().nullable(),
    reviewedAt: z.string().nullable(),
    photoUrl: z.string().nullable().describe('URL firmato di lettura, valido 600 secondi'),
  })
  .openapi('Proposal');
export type Proposal = z.infer<typeof Proposal>;

export const ProposalsQuery = PageQuery.extend({
  status: z.enum(['attesa', 'pubblicata', 'rifiutata', 'tutte']).default('attesa'),
});

// ---- public
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROPOSAL_MIMES = ['image/webp', 'image/jpeg', 'image/png'] as const;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const ProposalUploadBody = z
  .strictObject({ mime: z.enum(PROPOSAL_MIMES), size: z.number().int().min(1) })
  .openapi('ProposalUploadUrlBody');

export const ProposalSubmit = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    category: PostCategory,
    eventDate: z.iso.date().optional(),
    location: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(3000),
    photoPath: z
      .string()
      .regex(new RegExp(`^${UUID}\\.(jpg|jpeg|png|webp)$`), 'Percorso foto non valido')
      .optional(),
    videoUrl: z
      .string()
      .trim()
      .max(500)
      .regex(/^https:\/\//, 'Il link deve iniziare con https://')
      .pipe(Href)
      .optional(),
    submitterName: z.string().trim().min(1).max(120),
    submitterContact: z.string().trim().min(1).max(200).optional(),
    turnstileToken: z.string().max(4096).optional(), // required only when TURNSTILE_SECRET_KEY is set
  })
  .openapi('ProposalSubmit');
export const ProposalCreated = z.object({ id: z.uuid() }).openapi('ProposalCreated');
