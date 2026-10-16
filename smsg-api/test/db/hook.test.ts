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
