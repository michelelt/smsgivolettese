import { afterAll, describe, expect, it } from 'vitest';
import { ID, fixtures, rolledBack, sql } from './helpers';

afterAll(() => sql.end());

const claimsFor = async (tx: Parameters<Parameters<typeof rolledBack>[0]>[0], id: string) => {
  const event = { user_id: id, claims: { sub: id, role: 'authenticated' } };
  const [r] = await tx`select app.custom_access_token_hook(${tx.json(event)}) as e`;
  return r!.e.claims as Record<string, unknown>;
};

describe('custom access token hook (function)', () => {
  it('adds app_role for active users and drops it otherwise', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      expect((await claimsFor(tx, ID.admin)).app_role).toBe('super_admin');
      expect((await claimsFor(tx, ID.staff)).app_role).toBe('staff');
      expect((await claimsFor(tx, ID.vol)).app_role).toBe('volontario');
      expect(await claimsFor(tx, ID.noRole)).not.toHaveProperty('app_role');
      await tx`update profiles set active = false where id = ${ID.vol}`;
      expect(await claimsFor(tx, ID.vol)).not.toHaveProperty('app_role');
    });
  });
  it('only supabase_auth_admin can execute it', async () => {
    const [r] =
      await sql`select has_function_privilege('supabase_auth_admin', 'app.custom_access_token_hook(jsonb)', 'execute') as a,
      has_function_privilege('anon', 'app.custom_access_token_hook(jsonb)', 'execute') as b,
      has_function_privilege('authenticated', 'app.custom_access_token_hook(jsonb)', 'execute') as c`;
    expect(r).toEqual({ a: true, b: false, c: false });
  });
});

describe('custom access token hook (real login through Auth)', () => {
  const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'; // local-only key
  const cases = [
    ['admin.esempio@example.test', 'super_admin'],
    ['staff.esempio@example.test', 'staff'],
    ['volontario.esempio@example.test', 'volontario'],
  ] as const;
  for (const [email, role] of cases) {
    it(`${email} gets app_role=${role} in the JWT (needs make db-reset seed)`, async () => {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: key, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'Esempio-Locale-123!' }),
      });
      expect(res.status).toBe(200);
      const { access_token } = (await res.json()) as { access_token: string };
      const payload = JSON.parse(Buffer.from(access_token.split('.')[1]!, 'base64url').toString());
      expect(payload.app_role).toBe(role);
      expect(payload.role).toBe('authenticated');
    });
  }
  it('public sign-up is disabled', async () => {
    const res = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'nuovo.esempio@example.test',
        password: 'Esempio-Locale-123!',
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('custom access token hook: no link sessions for staff/super_admin', () => {
  const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
  const secret = process.env.SUPABASE_SECRET_KEY ?? 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
  const post = (path: string, apikey: string, body: object, auth = false) =>
    fetch(`${url}/auth/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey,
        'content-type': 'application/json',
        ...(auth ? { authorization: `Bearer ${apikey}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const verify = async (type: 'magiclink' | 'recovery' | 'invite', email: string) => {
    const g = (await (await post('admin/generate_link', secret, { type, email }, true)).json()) as {
      hashed_token: string;
    };
    return post('verify', key, { type, token_hash: g.hashed_token });
  };
  const staffLike = ['admin.esempio@example.test', 'staff.esempio@example.test'];

  for (const email of staffLike)
    for (const type of ['magiclink', 'recovery'] as const)
      it(`${type} for ${email} issues no session`, async () => {
        const res = await verify(type, email);
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(await res.text()).not.toContain('access_token');
      });

  it('password login still works for staff', async () => {
    const res = await post('token?grant_type=password', key, {
      email: staffLike[1],
      password: 'Esempio-Locale-123!',
    });
    expect(res.status).toBe(200);
  });
  it('volunteer magic link and recovery work, and refresh keeps working', async () => {
    for (const type of ['magiclink', 'recovery'] as const) {
      const res = await verify(type, 'volontario.esempio@example.test');
      expect(res.status).toBe(200);
      const { refresh_token } = (await res.json()) as { refresh_token: string };
      expect((await post('token?grant_type=refresh_token', key, { refresh_token })).status).toBe(
        200,
      );
    }
  });
  it('hook refuses refresh of a link-born staff session (function level, amr otp)', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx`insert into app.password_set values (${ID.staff})`;
      const event = {
        user_id: ID.staff,
        authentication_method: 'token_refresh',
        claims: { sub: ID.staff, amr: [{ method: 'otp', timestamp: 1 }] },
      };
      const [r] = await tx`select app.custom_access_token_hook(${tx.json(event)}) as e`;
      expect(r!.e.error.http_code).toBe(403);
      await tx`delete from app.password_set where user_id = ${ID.staff}`; // invite: no password yet
      const [r2] = await tx`select app.custom_access_token_hook(${tx.json(event)}) as e`;
      expect(r2!.e.claims).not.toHaveProperty('app_role');
    });
  });

  it('invite flow: no app_role until a password is set, then no more link sessions', async () => {
    const email = `invito.${Date.now()}@example.test`;
    const g = (await (
      await post('admin/generate_link', secret, { type: 'invite', email }, true)
    ).json()) as {
      id: string;
      hashed_token: string;
    };
    try {
      await sql`insert into profiles (id, first_name, last_name, email) values (${g.id}, 'Invitato', '(esempio)', ${email})`;
      await sql`insert into user_roles values (${g.id}, 'staff')`;
      const v = await post('verify', key, { type: 'invite', token_hash: g.hashed_token });
      const vt = await v.text();
      expect(v.status, vt).toBe(200);
      const { access_token } = JSON.parse(vt) as { access_token: string };
      const claimsOf = (t: string) =>
        JSON.parse(Buffer.from(t.split('.')[1]!, 'base64url').toString());
      expect(claimsOf(access_token)).not.toHaveProperty('app_role');
      const pw = 'Nuova-Password-Esempio-123!';
      const up = await fetch(`${url}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: key,
          authorization: `Bearer ${access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ password: pw }),
      });
      expect(up.status).toBe(200);
      const login = await post('token?grant_type=password', key, { email, password: pw });
      expect(login.status).toBe(200);
      expect(
        claimsOf(((await login.json()) as { access_token: string }).access_token).app_role,
      ).toBe('staff');
      const res = await verify('magiclink', email);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await res.text()).not.toContain('access_token');
    } finally {
      await sql`delete from user_roles where user_id = ${g.id}`;
      await sql`delete from profiles where id = ${g.id}`;
      await fetch(`${url}/auth/v1/admin/users/${g.id}`, {
        method: 'DELETE',
        headers: { apikey: secret, authorization: `Bearer ${secret}` },
      });
    }
  });
});
