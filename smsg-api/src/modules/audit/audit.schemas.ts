import { z } from '@hono/zod-openapi';
import { PageQuery, pageOf } from '../../lib/pagination.js';

export const AUDIT_TABLES = [
  'profiles',
  'user_roles',
  'volunteers',
  'services',
  'site_settings',
  'clients',
  'members',
  'membership_fees',
  'invoices',
  'invoice_lines',
  'invoice_counters',
  'org_settings',
  'shifts',
  'shift_assignments',
  'transports',
  'posts',
  'media',
  'post_proposals',
] as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data AAAA-MM-GG');

export const AuditQuery = PageQuery.extend({
  table: z.enum(AUDIT_TABLES).optional(),
  rowId: z.string().trim().min(1).max(100).optional(),
  actorId: z.uuid().optional(),
  action: z.enum(['insert', 'update', 'delete', 'export']).optional(),
  from: date.optional(),
  to: date.optional(),
});
export type AuditQuery = z.infer<typeof AuditQuery>;

const json = z.record(z.string(), z.unknown()).nullable();
export const AuditEntry = z
  .strictObject({
    id: z.number().int(),
    at: z.string(),
    actorId: z.uuid().nullable(),
    actorName: z.string().nullable(),
    actorRole: z.string().nullable(),
    action: z.string(),
    tableName: z.string(),
    rowId: z.string().nullable(),
    before: json,
    after: json,
    redacted: z.boolean(),
  })
  .openapi('AuditEntry');
export const AuditPage = pageOf(AuditEntry).openapi('AuditPage');
