import postgres from 'postgres';

export const DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
export const sql = postgres(DB_URL, { max: 12, onnotice: () => {}, prepare: false });

export type Role = 'anon' | 'volontario' | 'staff' | 'super_admin';
export const ROLES: Role[] = ['anon', 'volontario', 'staff', 'super_admin'];
const RANK: Record<Role, number> = { anon: 0, volontario: 1, staff: 2, super_admin: 3 };
export const rank = (r: Role) => RANK[r];

export const ID = {
  admin: 'f0000000-0000-4000-8000-000000000001',
  staff: 'f0000000-0000-4000-8000-000000000002',
  vol: 'f0000000-0000-4000-8000-000000000003',
  vol2: 'f0000000-0000-4000-8000-000000000004',
  spareUser: 'f0000000-0000-4000-8000-000000000005',
  noRole: 'f0000000-0000-4000-8000-000000000006',
};
export const userOf = (r: Role) =>
  r === 'anon' ? null : { volontario: ID.vol, staff: ID.staff, super_admin: ID.admin }[r];

type Tx = postgres.TransactionSql;
const ROLLBACK = Symbol('rollback');

/** Runs fn in a transaction that is always rolled back. */
export async function rolledBack<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let out: T | undefined;
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("set local timezone = 'Europe/Rome'"); // current_date in fixtures/tests = the Rome date the DB functions use
      out = await fn(tx);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return out as T;
}

/** Switch the current tx to a Supabase API role with the given JWT claims (ADR-002). */
export async function actAs(tx: Tx, role: Role, uid: string | null = userOf(role)) {
  const claims =
    role === 'anon' ? { role: 'anon' } : { role: 'authenticated', sub: uid, app_role: role };
  await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
  await tx.unsafe(`set local role ${role === 'anon' ? 'anon' : 'authenticated'}`);
}

/** Fixture world, inserted as postgres before switching role. All inside the rolled-back tx. */
export async function fixtures(tx: Tx) {
  await tx.unsafe(`
    insert into auth.users (id, email, aud, role) values
      ('${ID.admin}','admin@t.test','authenticated','authenticated'),('${ID.staff}','staff@t.test','authenticated','authenticated'),
      ('${ID.vol}','vol@t.test','authenticated','authenticated'),('${ID.vol2}','vol2@t.test','authenticated','authenticated'),
      ('${ID.spareUser}','spare@t.test','authenticated','authenticated'),('${ID.noRole}','norole@t.test','authenticated','authenticated');
    insert into profiles (id, first_name, last_name, email) values
      ('${ID.admin}','A','Admin','admin@t.test'),('${ID.staff}','S','Staff','staff@t.test'),
      ('${ID.vol}','V','Vol','vol@t.test'),('${ID.vol2}','W','Vol2','vol2@t.test'),('${ID.spareUser}','X','Spare','spare@t.test'),('${ID.noRole}','N','NoRole','norole@t.test');
    insert into user_roles values ('${ID.admin}','super_admin'),('${ID.staff}','staff'),('${ID.vol}','volontario'),
      ('${ID.vol2}','volontario'),('${ID.spareUser}','volontario');
    insert into volunteers (id, can_drive, license_expires_on) values
      ('${ID.vol}', true, current_date + 400),('${ID.vol2}', false, null);
    insert into vehicles (id, plate, model, seats) values
      ('f1000000-0000-4000-8000-000000000001','TT001TT','T',4),('f1000000-0000-4000-8000-000000000002','TT002TT','T',4);
    insert into availability_rules (id, volunteer_id, weekday, start_time, end_time) values
      ('f2000000-0000-4000-8000-000000000001','${ID.vol}',1,'08:00','12:00'),
      ('f2000000-0000-4000-8000-000000000002','${ID.vol2}',1,'08:00','12:00');
    insert into availability_exceptions (id, volunteer_id, starts_on, ends_on, kind) values
      ('f3000000-0000-4000-8000-000000000001','${ID.vol}',current_date,current_date,'assente'),
      ('f3000000-0000-4000-8000-000000000002','${ID.vol2}',current_date,current_date,'assente');
    insert into shift_types (id, name) values
      ('f4000000-0000-4000-8000-000000000001','T-type'),('f4000000-0000-4000-8000-000000000002','T-spare');
    insert into shifts (id, shift_type_id, starts_at, ends_at, required_slots) values
      ('f5000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001', now()+interval '1 day', now()+interval '1 day 3 hours', 2),
      ('f5000000-0000-4000-8000-000000000002','f4000000-0000-4000-8000-000000000001', now()+interval '2 day', now()+interval '2 day 3 hours', 2),
      ('f5000000-0000-4000-8000-000000000003','f4000000-0000-4000-8000-000000000001', now()+interval '3 day', now()+interval '3 day 3 hours', 2);
    insert into shift_assignments (id, shift_id, volunteer_id) values
      ('f6000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','${ID.vol}'),
      ('f6000000-0000-4000-8000-000000000002','f5000000-0000-4000-8000-000000000002','${ID.vol2}'),
      ('f6000000-0000-4000-8000-000000000003','f5000000-0000-4000-8000-000000000001','${ID.vol2}');
    insert into members (id, card_number, first_name, last_name, joined_on) values
      ('f7000000-0000-4000-8000-000000000001', 9001, 'M', 'Member', current_date);
    insert into membership_fees (id, member_id, year, amount_cents, paid_on, method) values
      ('f8000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001',2025,2000,current_date,'contanti'),
      ('f8000000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000001',2024,2000,current_date,'contanti');
    insert into services (id, name, price_cents, active) values
      ('fa000000-0000-4000-8000-000000000001','S-active',0,true),('fa000000-0000-4000-8000-000000000002','S-inactive',0,false),
      ('fa000000-0000-4000-8000-000000000003','S-spare',0,true);
    insert into bookings (id, member_id, service_id, day, slot, price_applied_cents, origin, status) values
      ('fb000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001',current_date,'mattina',300,'telefono','eseguita');
    insert into transports (id, member_id, travel_date, departure_at, from_address, to_address, driver_volunteer_id, status) values
      ('fc000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000001',current_date, now()+interval '10 days','a','b','${ID.vol}','assegnato'),
      ('fc000000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000001',current_date, null,null,null,null,'richiesto');
    insert into invoices (id, year, number, issued_on, member_id, customer_name, issuer_name, vat_exemption_text, subtotal_cents, stamp_duty_cents, total_cents, status) values
      ('fd000000-0000-4000-8000-000000000001', 2020, 1, current_date, 'f7000000-0000-4000-8000-000000000001','C','I','v',300,0,300,'emessa');
    insert into invoice_lines (id, invoice_id, position, description, amount_cents) values
      ('fd100000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000001',1,'d',300);
    insert into invoice_counters (year, last_number) values (2020, 1);
    insert into media (id, bucket, path, mime, size_bytes) values
      ('fe000000-0000-4000-8000-000000000001','media','t/a.png','image/png',1),('fe000000-0000-4000-8000-000000000002','proposals','t/b.png','image/png',1),
      ('fe000000-0000-4000-8000-000000000003','media','t/c.png','image/png',1);
    insert into posts (id, slug, title, category, status, published_at) values
      ('ff000000-0000-4000-8000-000000000001','t-pub','P','notizia','pubblicata', now() - interval '1 day'),
      ('ff000000-0000-4000-8000-000000000002','t-draft','P','notizia','bozza', null),
      ('ff000000-0000-4000-8000-000000000003','t-spare','P','notizia','bozza', null);
    insert into post_proposals (id, title, category, body, submitter_name) values
      ('ff100000-0000-4000-8000-000000000001','P','notizia','b','n'),('ff100000-0000-4000-8000-000000000002','P','notizia','b','n');
    insert into rate_limit_hits values ('t', now(), 1);
  `);
}

export type Outcome = { ok: boolean; rows: number; code?: string; message?: string };

/** Run a statement; an RLS-filtered statement is ok with 0 rows. Errors are caught via savepoint. */
export async function attempt(tx: Tx, statement: string): Promise<Outcome> {
  try {
    const rows = await tx.savepoint(async (sp) => sp.unsafe(statement));
    return { ok: true, rows: rows.length };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, rows: 0, code: err.code, message: err.message };
  }
}

/** Table owner cleanup for committed concurrency tests (immutability triggers are bypassed on purpose). */
export async function sqlCode(p: Promise<unknown>): Promise<{ code?: string; message?: string }> {
  try {
    await p;
    return {};
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { code: err.code, message: err.message };
  }
}
