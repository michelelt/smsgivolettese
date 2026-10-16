import { afterAll, describe, expect, it } from 'vitest';
import { rolledBack, sql } from './helpers';

afterAll(() => sql.end());

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

describe('PostgREST exposes nothing (ADR-003)', () => {
  it.each(['anon', 'staff'])('%s cannot reach rpc or tables', async (who) => {
    let bearer = anonKey;
    if (who === 'staff') {
      const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: anonKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'staff.esempio@example.test',
          password: 'Esempio-Locale-123!',
        }),
      });
      bearer = ((await r.json()) as { access_token: string }).access_token;
    }
    const h = {
      apikey: anonKey,
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
    };
    for (const profile of [undefined, 'public']) {
      const headers = profile ? { ...h, 'Accept-Profile': profile, 'Content-Profile': profile } : h;
      for (const [path, method] of [
        ['rpc/submit_public_booking', 'POST'],
        ['services', 'GET'],
        ['services', 'POST'],
        ['profiles', 'GET'],
      ] as const) {
        const res = await fetch(`${url}/rest/v1/${path}`, {
          method,
          headers,
          body: method === 'POST' ? '{}' : undefined,
        });
        expect([400, 401, 404, 406], `${method} ${path} ${profile}`).toContain(res.status);
        expect(await res.text()).not.toContain('Misurazione');
      }
    }
  });
});

describe('table privileges', () => {
  it('every public table has RLS enabled', async () => {
    const rows =
      await sql`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
  it('anon/authenticated grants stay within the allowlist (no TRUNCATE/TRIGGER/REFERENCES)', async () => {
    const rows =
      await sql`select grantee, table_name, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon','authenticated')`;
    const bad = rows.filter(
      (r) =>
        !['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(r.privilege_type) ||
        (r.grantee === 'anon' &&
          !(
            r.privilege_type === 'SELECT' &&
            ['services', 'posts', 'site_settings', 'media'].includes(r.table_name)
          )),
    );
    expect(bad).toEqual([]);
  });
  it('default privileges do not grant TRUNCATE/TRIGGER/REFERENCES on future tables', async () => {
    const r = await rolledBack(async (tx) => {
      await tx`create table public.zz_future (id int)`;
      return tx`select privilege_type from information_schema.role_table_grants where table_name = 'zz_future'
        and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')`;
    });
    expect(r).toEqual([]);
  });
});
