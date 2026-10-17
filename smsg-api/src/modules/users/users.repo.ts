import type { Tx } from '../../lib/db.js';
import { containsPattern, offsetOf } from '../../lib/pagination.js';
import type { UserItem, UsersQuery } from './users.schemas.js';

const SELECT = (tx: Tx) => tx`
  select p.id, p.first_name as "firstName", p.last_name as "lastName", p.email, p.phone,
         ur.role, p.active, p.anonymized_at::text as "anonymizedAt"
  from public.profiles p join public.user_roles ur on ur.user_id = p.id`;

export async function list(tx: Tx, q: UsersQuery) {
  const p = q.q ? containsPattern(q.q) : null;
  const where = tx`where true
    ${q.role ? tx`and ur.role = ${q.role}` : tx``}
    ${q.active === undefined ? tx`` : tx`and p.active = ${q.active}`}
    ${p ? tx`and (p.first_name || ' ' || p.last_name ilike ${p} or p.last_name || ' ' || p.first_name ilike ${p} or p.email ilike ${p})` : tx``}`;
  const items = await tx<UserItem[]>`${SELECT(tx)} ${where}
    order by p.last_name, p.first_name limit ${q.pageSize} offset ${offsetOf(q)}`;
  const [t] = await tx<{ total: number }[]>`select count(*)::int as total
    from public.profiles p join public.user_roles ur on ur.user_id = p.id ${where}`;
  return { items, total: t!.total };
}

export const get = async (tx: Tx, id: string) =>
  (await tx<UserItem[]>`${SELECT(tx)} where p.id = ${id}`)[0];

/** Locks the role row and says whether another active super admin exists. */
export const lockRole = async (tx: Tx, id: string) =>
  (
    await tx<{ role: string; active: boolean; anonymized: boolean; otherSuperAdmin: boolean }[]>`
      select ur.role, p.active, p.anonymized_at is not null as anonymized,
             exists (select 1 from public.user_roles o join public.profiles op on op.id = o.user_id
                     where o.role = 'super_admin' and op.active and o.user_id <> ur.user_id) as "otherSuperAdmin"
      from public.user_roles ur join public.profiles p on p.id = ur.user_id
      where ur.user_id = ${id} for update of ur`
  )[0];

export const setRole = (tx: Tx, id: string, role: string) =>
  tx`update public.user_roles set role = ${role}, updated_at = now() where user_id = ${id}`;

export const upsertVolunteer = (tx: Tx, id: string) =>
  tx`insert into public.volunteers (id) values (${id})
     on conflict (id) do update set active = true, updated_at = now()`;

export const deactivateVolunteer = (tx: Tx, id: string) =>
  tx`update public.volunteers set active = false, updated_at = now() where id = ${id} and active`;

/** Conditional flip; zero rows = already in the target state. */
export const setActive = async (tx: Tx, id: string, active: boolean) =>
  (
    await tx`update public.profiles set active = ${active}, updated_at = now()
             where id = ${id} and active = ${!active} and anonymized_at is null returning id`
  ).length;

export const auditMfaReset = (tx: Tx, id: string, removed: number, requestId?: string) =>
  tx`insert into public.audit_log (actor_id, actor_role, request_id, action, table_name, row_id, after)
     values (nullif(current_setting('app.actor_id', true), '')::uuid,
             nullif(current_setting('app.actor_role', true), '')::public.app_role,
             ${requestId ?? null}, 'update', 'profiles', ${id},
             ${tx.json({ mfaReset: true, removed })})`;
