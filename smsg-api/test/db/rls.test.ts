import { afterAll, describe, expect, it } from 'vitest';
import { ID, ROLES, actAs, attempt, fixtures, rank, rolledBack, sql, type Role } from './helpers';
import { specs, type Min } from './rls.matrix';

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
