import type { z } from '@hono/zod-openapi';
import type { Tx } from '../../lib/db.js';
import { offsetOf } from '../../lib/pagination.js';
import type { AuditEntry, AuditQuery } from './audit.schemas.js';

export async function list(tx: Tx, q: AuditQuery) {
  // from/to are calendar days in Europe/Rome, `to` inclusive
  const where = tx`where true
    ${q.table ? tx`and a.table_name = ${q.table}` : tx``}
    ${q.rowId ? tx`and a.row_id = ${q.rowId}` : tx``}
    ${q.actorId ? tx`and a.actor_id = ${q.actorId}` : tx``}
    ${q.action ? tx`and a.action = ${q.action}` : tx``}
    ${q.from ? tx`and a.at >= (${q.from}::date)::timestamp at time zone 'Europe/Rome'` : tx``}
    ${q.to ? tx`and a.at < ((${q.to}::date + 1)::timestamp at time zone 'Europe/Rome')` : tx``}`;
  const items = await tx<z.infer<typeof AuditEntry>[]>`
    select a.id::int as id, a.at::text as at, a.actor_id as "actorId",
           nullif(trim(p.first_name || ' ' || p.last_name), '') as "actorName",
           a.actor_role as "actorRole", a.action, a.table_name as "tableName", a.row_id as "rowId",
           a.before, a.after, a.redacted
    from public.audit_log a left join public.profiles p on p.id = a.actor_id
    ${where} order by a.at desc, a.id desc limit ${q.pageSize} offset ${offsetOf(q)}`;
  const [t] = await tx<
    { total: number }[]
  >`select count(*)::int as total from public.audit_log a ${where}`;
  return { items, total: t!.total };
}
