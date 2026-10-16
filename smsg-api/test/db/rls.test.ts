import { afterAll, describe, expect, it } from 'vitest';
import { ID, ROLES, actAs, attempt, fixtures, rank, rolledBack, sql, type Role } from './helpers';

type Min = Role | null | ((r: Role) => boolean); // minimum role, null = nobody, or custom (ownership)
type Spec = { S?: [Min, string]; I?: [Min, string]; U?: [Min, string]; D?: [Min, string] };

const own: Min = (r) => r === 'volontario' || r === 'super_admin'; // rows owned by the fixture volunteer

const specs: Record<string, Spec> = {
  profiles: {
    S: ['volontario', 'select 1 from profiles'],
    U: ['staff', `update profiles set phone = '1' where id = '${ID.vol}' returning 1`],
  },
  user_roles: {
    S: ['volontario', 'select 1 from user_roles'],
    I: ['super_admin', `insert into user_roles values ('${ID.noRole}', 'staff') returning 1`],
    U: [
      'super_admin',
      `update user_roles set role = 'staff' where user_id = '${ID.spareUser}' returning 1`,
    ],
    D: ['super_admin', `delete from user_roles where user_id = '${ID.spareUser}' returning 1`],
  },
  volunteers: {
    S: ['volontario', 'select 1 from volunteers'],
    I: ['staff', `insert into volunteers (id) values ('${ID.noRole}') returning 1`],
    U: ['staff', `update volunteers set notes = 'x' where id = '${ID.vol}' returning 1`],
    D: [null, `delete from volunteers where id = '${ID.vol2}' returning 1`],
  },
  vehicles: {
    S: ['staff', 'select 1 from vehicles'],
    I: ['staff', `insert into vehicles (plate, model, seats) values ('NEW1', 'm', 4) returning 1`],
    U: ['staff', `update vehicles set model = 'x' returning 1`],
    D: [
      'staff',
      `delete from vehicles where id = 'f1000000-0000-4000-8000-000000000002' returning 1`,
    ],
  },
  availability_rules: {
    S: ['volontario', 'select 1 from availability_rules'],
    I: [
      own,
      `insert into availability_rules (volunteer_id, weekday, start_time, end_time) values ('${ID.vol}', 2, '08:00', '12:00') returning 1`,
    ],
    U: [
      own,
      `update availability_rules set weekday = 3 where id = 'f2000000-0000-4000-8000-000000000001' returning 1`,
    ],
    D: [
      own,
      `delete from availability_rules where id = 'f2000000-0000-4000-8000-000000000001' returning 1`,
    ],
  },
  availability_exceptions: {
    S: ['volontario', 'select 1 from availability_exceptions'],
    I: [
      own,
      `insert into availability_exceptions (volunteer_id, starts_on, ends_on, kind) values ('${ID.vol}', current_date, current_date, 'assente') returning 1`,
    ],
    U: [
      own,
      `update availability_exceptions set note = 'x' where id = 'f3000000-0000-4000-8000-000000000001' returning 1`,
    ],
    D: [
      own,
      `delete from availability_exceptions where id = 'f3000000-0000-4000-8000-000000000001' returning 1`,
    ],
  },
  shift_types: {
    S: ['volontario', 'select 1 from shift_types'],
    I: ['staff', `insert into shift_types (name) values ('new') returning 1`],
    U: ['staff', `update shift_types set sort_order = 5 returning 1`],
    D: [
      'staff',
      `delete from shift_types where id = 'f4000000-0000-4000-8000-000000000002' returning 1`,
    ],
  },
  shifts: {
    S: ['volontario', 'select 1 from shifts'],
    I: [
      'staff',
      `insert into shifts (shift_type_id, starts_at, ends_at, required_slots) values ('f4000000-0000-4000-8000-000000000001', now() + interval '9 day', now() + interval '9 day 1 hour', 1) returning 1`,
    ],
    U: ['staff', `update shifts set notes = 'x' returning 1`],
    D: [
      'staff',
      `delete from shifts where id = 'f5000000-0000-4000-8000-000000000003' returning 1`,
    ],
  },
  shift_assignments: {
    S: ['volontario', 'select 1 from shift_assignments'],
    I: [
      'staff',
      `insert into shift_assignments (shift_id, volunteer_id) values ('f5000000-0000-4000-8000-000000000003', '${ID.vol}') returning 1`,
    ],
    U: ['staff', `update shift_assignments set status = 'confermato' returning 1`],
    D: [
      'staff',
      `delete from shift_assignments where id = 'f6000000-0000-4000-8000-000000000003' returning 1`,
    ],
  },
  volunteer_commitments: {
    S: ['staff', 'select 1 from volunteer_commitments'],
    I: [
      null,
      `insert into volunteer_commitments (volunteer_id, period, transport_id) values ('${ID.vol}', '[2030-01-01,2030-01-02)', 'fc000000-0000-4000-8000-000000000002') returning 1`,
    ],
    U: [null, `update volunteer_commitments set period = period returning 1`],
    D: [null, `delete from volunteer_commitments returning 1`],
  },
  transports: {
    S: ['staff', 'select 1 from transports'],
    I: [
      'staff',
      `insert into transports (client_id, travel_date) values ('f9000000-0000-4000-8000-000000000001', current_date) returning 1`,
    ],
    U: ['staff', `update transports set notes = 'x' returning 1`],
    D: [null, `delete from transports returning 1`],
  },
  clients: {
    S: ['staff', 'select 1 from clients'],
    I: [
      'staff',
      `insert into clients (first_name, last_name, phone) values ('a', 'b', '123456') returning 1`,
    ],
    U: ['staff', `update clients set notes = 'x' returning 1`],
    D: [null, `delete from clients returning 1`],
  },
  services: {
    S: ['anon', 'select 1 from services'],
    I: [
      'staff',
      `insert into services (name, member_price_cents, non_member_price_cents) values ('n', 0, 0) returning 1`,
    ],
    U: ['staff', `update services set sort_order = 1 returning 1`],
    D: [
      'staff',
      `delete from services where id = 'fa000000-0000-4000-8000-000000000003' returning 1`,
    ],
  },
  bookings: {
    S: ['staff', 'select 1 from bookings'],
    I: [
      'staff',
      `insert into bookings (client_id, service_id, day, slot, declared_member, price_applied_cents, origin) values ('f9000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001', current_date, 'mattina', false, 0, 'telefono') returning 1`,
    ],
    U: ['staff', `update bookings set notes = 'x' returning 1`],
    D: [null, `delete from bookings returning 1`],
  },
  members: {
    S: ['staff', 'select 1 from members'],
    I: [
      null,
      `insert into members (card_number, first_name, last_name, joined_on) values (9999, 'a', 'b', current_date) returning 1`,
    ],
    U: ['staff', `update members set notes = 'x' returning 1`],
    D: [null, `delete from members returning 1`],
  },
  membership_fees: {
    S: ['staff', 'select 1 from membership_fees'],
    I: [
      'staff',
      `insert into membership_fees (member_id, year, amount_cents, paid_on, method) values ('f7000000-0000-4000-8000-000000000001', 2023, 1, current_date, 'pos') returning 1`,
    ],
    U: ['staff', `update membership_fees set amount_cents = 5 returning 1`],
    D: [
      'super_admin',
      `delete from membership_fees where id = 'f8000000-0000-4000-8000-000000000002' returning 1`,
    ],
  },
  invoices: {
    S: ['staff', 'select 1 from invoices'],
    I: [
      null,
      `insert into invoices (year, number, issued_on, client_id, customer_name, issuer_name, vat_exemption_text, subtotal_cents, stamp_duty_cents, total_cents, status) values (2021, 1, current_date, 'f9000000-0000-4000-8000-000000000001', 'c', 'i', 'v', 1, 0, 1, 'emessa') returning 1`,
    ],
    U: [
      'staff',
      `update invoices set status = 'pagata', payment_method = 'pos', paid_on = current_date returning 1`,
    ],
    D: [null, `delete from invoices returning 1`],
  },
  invoice_lines: {
    S: ['staff', 'select 1 from invoice_lines'],
    I: [
      null,
      `insert into invoice_lines (invoice_id, position, description, amount_cents) values ('fd000000-0000-4000-8000-000000000001', 2, 'd', 1) returning 1`,
    ],
    U: [null, `update invoice_lines set description = 'x' returning 1`],
    D: [null, `delete from invoice_lines returning 1`],
  },
  invoice_counters: {
    S: ['staff', 'select 1 from invoice_counters'],
    I: [null, `insert into invoice_counters (year) values (2021) returning 1`],
    U: [null, `update invoice_counters set last_number = 50 returning 1`],
    D: [null, `delete from invoice_counters returning 1`],
  },
  posts: {
    S: ['anon', 'select 1 from posts'],
    I: [
      'staff',
      `insert into posts (slug, title, category) values ('t-new', 't', 'avviso') returning 1`,
    ],
    U: ['staff', `update posts set title = 'x' returning 1`],
    D: ['staff', `delete from posts where id = 'ff000000-0000-4000-8000-000000000003' returning 1`],
  },
  post_proposals: {
    S: ['staff', 'select 1 from post_proposals'],
    I: [
      null,
      `insert into post_proposals (title, category, body, submitter_name) values ('t', 'avviso', 'b', 'n') returning 1`,
    ],
    U: ['staff', `update post_proposals set status = 'rifiutata' returning 1`],
    D: [
      'super_admin',
      `delete from post_proposals where id = 'ff100000-0000-4000-8000-000000000002' returning 1`,
    ],
  },
  media: {
    S: ['anon', 'select 1 from media'],
    I: [
      'staff',
      `insert into media (bucket, path, mime, size_bytes) values ('media', 'n/x.png', 'image/png', 1) returning 1`,
    ],
    U: [null, `update media set alt = 'x' returning 1`],
    D: ['staff', `delete from media where id = 'fe000000-0000-4000-8000-000000000003' returning 1`],
  },
  site_settings: {
    S: ['anon', 'select 1 from site_settings'],
    I: [null, `insert into site_settings (id) values (false) returning 1`],
    U: ['staff', `update site_settings set slogan = 'x' returning 1`],
    D: [null, `delete from site_settings returning 1`],
  },
  org_settings: {
    S: ['super_admin', 'select 1 from org_settings'],
    I: [null, `insert into org_settings (id) values (false) returning 1`],
    U: ['super_admin', `update org_settings set membership_fee_cents = 2500 returning 1`],
    D: [null, `delete from org_settings returning 1`],
  },
  audit_log: {
    S: ['super_admin', 'select 1 from audit_log'],
    I: [null, `insert into audit_log (action, table_name) values ('insert', 'x') returning 1`],
    U: [null, `update audit_log set redacted = true returning 1`],
    D: [null, `delete from audit_log returning 1`],
  },
  rate_limit_hits: {
    S: [null, 'select 1 from rate_limit_hits'],
    I: [null, `insert into rate_limit_hits values ('k', now(), 1) returning 1`],
    U: [null, `update rate_limit_hits set hits = 2 returning 1`],
    D: [null, `delete from rate_limit_hits returning 1`],
  },
};

const allowed = (min: Min, r: Role) =>
  min === null ? false : typeof min === 'function' ? min(r) : rank(r) >= rank(min);
const OPS = { S: 'select', I: 'insert', U: 'update', D: 'delete' } as const;

afterAll(() => sql.end());

describe('RLS matrix (docs/permissions.md)', () => {
  for (const [table, spec] of Object.entries(specs)) {
    for (const op of ['S', 'I', 'U', 'D'] as const) {
      const entry = spec[op];
      if (!entry) continue;
      for (const role of ROLES) {
        const ok = allowed(entry[0], role);
        it(`${table} ${OPS[op]} as ${role}: ${ok ? 'allowed' : 'denied'}`, async () => {
          await rolledBack(async (tx) => {
            await fixtures(tx);
            await actAs(tx, role);
            const r = await attempt(tx, entry[1]);
            if (ok) {
              expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
              expect(r.rows).toBeGreaterThan(0);
            } else if (op === 'I') {
              expect(r.code).toBe('42501');
            } else {
              expect(r.ok ? r.rows : 0).toBe(0);
              if (!r.ok) expect(r.code).toBe('42501');
            }
          });
        });
      }
    }
  }
});

async function count(role: Role, uid: string | null, q: string) {
  return rolledBack(async (tx) => {
    await fixtures(tx);
    await actAs(tx, role, uid);
    const r = await attempt(tx, q);
    return r.ok ? r.rows : -1;
  });
}

describe('ownership and filtering', () => {
  it('volunteer sees only own profile, assignments, availability, volunteer row', async () => {
    for (const t of ['profiles', 'volunteers'])
      expect(await count('volontario', ID.vol, `select 1 from ${t}`)).toBe(1);
    expect(await count('volontario', ID.vol, 'select 1 from shift_assignments')).toBe(1);
    expect(await count('volontario', ID.vol, 'select 1 from availability_rules')).toBe(1);
    expect(await count('volontario', ID.vol, 'select 1 from user_roles')).toBe(1);
  });
  it('volunteer sees only shifts with own assignment', async () => {
    expect(await count('volontario', ID.vol, 'select 1 from shifts')).toBe(1);
  });
  it('volunteer cannot write another volunteer availability', async () => {
    const q = (s: string) => `${s} where volunteer_id = '${ID.vol2}' returning 1`;
    expect(await count('volontario', ID.vol, q('update availability_rules set weekday = 4'))).toBe(
      0,
    );
    expect(await count('volontario', ID.vol, q('delete from availability_exceptions'))).toBe(0);
    expect(
      await count(
        'volontario',
        ID.vol,
        `insert into availability_rules (volunteer_id, weekday, start_time, end_time) values ('${ID.vol2}', 2, '08:00', '09:00') returning 1`,
      ),
    ).toBe(-1);
  });
  it('volunteer cannot update own profile directly (update_my_profile only)', async () => {
    expect(
      await count(
        'volontario',
        ID.vol,
        `update profiles set phone = '1' where id = '${ID.vol}' returning 1`,
      ),
    ).toBe(0);
  });
  it('anon sees only active services, published posts, public media', async () => {
    expect(await count('anon', null, 'select 1 from services')).toBe((await seededActive()) + 2);
    expect(await count('anon', null, `select 1 from posts where slug like 't-%'`)).toBe(1);
    expect(await count('anon', null, `select 1 from media where path like 't/%'`)).toBe(2);
    expect(await count('staff', ID.staff, `select 1 from posts where slug like 't-%'`)).toBe(3);
  });
  it('anon and volunteer cannot read org settings, audit, counters', async () => {
    for (const t of ['org_settings', 'audit_log', 'invoice_counters']) {
      expect(await count('volontario', ID.vol, `select 1 from ${t}`)).toBe(0);
    }
    expect((await count('anon', null, 'select 1 from audit_log')) <= 0).toBe(true);
  });
  it('volunteer_transports_v: own assigned transports only, anon denied', async () => {
    expect(await count('volontario', ID.vol, 'select 1 from volunteer_transports_v')).toBe(1);
    expect(await count('volontario', ID.vol2, 'select 1 from volunteer_transports_v')).toBe(0);
    expect(await count('anon', null, 'select 1 from volunteer_transports_v')).toBe(-1);
  });
  it('volunteer_transports_v exposes no sensitive columns', async () => {
    const cols =
      await sql`select column_name from information_schema.columns where table_name = 'volunteer_transports_v'`;
    const names = cols.map((c) => c.column_name);
    for (const bad of ['tax_code', 'reason', 'notes', 'address', 'client_id', 'booking_id'])
      expect(names).not.toContain(bad);
  });
  it('volunteers cannot read transports or clients base tables', async () => {
    expect(await count('volontario', ID.vol, 'select 1 from transports')).toBe(0);
    expect(await count('volontario', ID.vol, 'select 1 from clients')).toBe(0);
  });
  it('lower role cannot call staff functions', async () => {
    for (const role of ['anon', 'volontario'] as const) {
      const r = await rolledBack(async (tx) => {
        await fixtures(tx);
        await actAs(tx, role);
        return attempt(tx, `select register_member('{"first_name":"a","last_name":"b"}')`);
      });
      expect(r.code).toBe('42501');
    }
  });
});

async function seededActive() {
  const [r] =
    await sql`select count(*)::int as n from services where active and name not like 'S-%'`;
  return r!.n;
}
