import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { db } from '../../src/lib/db';
import { supabaseAdmin } from '../../src/lib/supabase-admin';
import { sql } from '../db/helpers';

const URL_ = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SECRET_KEY!; // only used as apikey for password sign-in in tests
const admin = supabaseAdmin();
const tag = Date.now().toString(36);
const PASSWORD = 'correct-horse-battery-1';
const users: Record<string, { id: string; email: string }> = {};

async function mkUser(name: string, role: string | null) {
  const email = `t-${name}-${tag}@auth.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;
  await sql`insert into profiles (id, first_name, last_name, email) values (${id}, 'T', ${name}, ${email})`;
  if (role) await sql`insert into user_roles (user_id, role) values (${id}, ${role}::app_role)`;
  users[name] = { id, email };
}

const client = () => createClient(URL_, KEY, { auth: { persistSession: false } });
async function login(name: string) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({
    email: users[name]!.email,
    password: PASSWORD,
  });
  if (error) throw error;
  return { c, token: data.session.access_token };
}
const me = (token?: string) =>
  app.request('/me', { headers: token ? { authorization: `Bearer ${token}` } : {} });

beforeAll(async () => {
  await mkUser('vol', 'volontario');
  await mkUser('staff', 'staff');
  await mkUser('admin', 'super_admin');
  await mkUser('norole', null);
});

afterAll(async () => {
  for (const u of Object.values(users)) {
    await sql`delete from user_roles where user_id = ${u.id}`;
    await sql`delete from profiles where id = ${u.id}`;
    await admin.auth.admin.deleteUser(u.id);
  }
  await sql`delete from rate_limit_hits where key = ${'t-' + tag}`;
  await db.end();
  await sql.end();
});

describe('JWT verification and requirePermission', () => {
  it('anonymous -> 401', async () => {
    expect((await me()).status).toBe(401);
  });
  it('garbage and tampered tokens -> 401', async () => {
    expect((await me('not.a.jwt')).status).toBe(401);
    const { token } = await login('vol');
    const [h, p, s] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: users.vol!.id, app_role: 'super_admin' }),
    ).toString('base64url');
    expect((await me(`${h}.${forged}.${s}`)).status).toBe(401);
    expect(p).toBeTruthy();
  });
  it.each([
    ['vol', 'volontario'],
    ['staff', 'staff'],
    ['admin', 'super_admin'],
  ])('%s -> 200 with role %s from app_role claim', async (name, role) => {
    const res = await me((await login(name)).token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: users[name]!.id, role });
  });
  it('valid user without a role -> 403', async () => {
    const res = await me((await login('norole')).token);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
  });
});

describe('db.asUser / asAnon / asService', () => {
  it('asUser sets claims and role; RLS applies', async () => {
    const r = await db.asUser({ sub: users.vol!.id, app_role: 'volontario' }, async (tx) => ({
      who: await tx`select auth.uid() as uid, app.role() as role, current_user as cu`,
      profiles: await tx`select id from profiles`,
    }));
    expect(r.who[0]).toMatchObject({ uid: users.vol!.id, role: 'volontario', cu: 'authenticated' });
    expect(r.profiles.map((p) => p.id)).toEqual([users.vol!.id]);
  });
  it('asAnon has no role', async () => {
    const r = await db.asAnon((tx) => tx`select app.role() as role, current_user as cu`);
    expect(r[0]).toMatchObject({ role: null, cu: 'anon' });
  });
  it('asService has no app_role claim, can call consume_rate_limit; users cannot', async () => {
    const r = await db.asService(async (tx) => ({
      who: await tx`select auth.jwt() ->> 'app_role' as role, current_user as cu`,
      rl: await tx`select app.consume_rate_limit(${'t-' + tag}, 5, 60) as ok`,
    }));
    expect(r.who[0]).toMatchObject({ role: null, cu: 'service_role' });
    expect(r.rl[0]!.ok).toBe(true);
    await expect(
      db.asUser(
        { sub: users.admin!.id, app_role: 'super_admin' },
        (tx) => tx`select app.consume_rate_limit('t', 5, 60)`,
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
});

describe('super admin password', () => {
  it('stale session needs reauthentication; nonce from email unlocks the change', async () => {
    const { c } = await login('admin');
    await sql`update auth.sessions set created_at = now() - interval '3 days' where user_id = ${users.admin!.id}`;
    const stale = await c.auth.updateUser({ password: 'another-long-password-2' });
    expect(stale.error).toBeTruthy(); // secure_password_change = true

    expect((await c.auth.reauthenticate()).error).toBeNull();
    let nonce: string | undefined;
    for (let i = 0; i < 20 && !nonce; i++) {
      const list = await (
        await fetch(
          'http://127.0.0.1:54324/api/v1/search?query=to:' + encodeURIComponent(users.admin!.email),
        )
      ).json();
      const id = list.messages?.[0]?.ID;
      if (id) {
        const m = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)).json();
        nonce = /\b(\d{6})\b/.exec(m.Text ?? '')?.[1];
      }
      if (!nonce) await new Promise((r) => setTimeout(r, 250));
    }
    expect(nonce).toBeTruthy();
    const ok = await c.auth.updateUser({ password: 'another-long-password-2', nonce });
    expect(ok.error).toBeNull();
  });

  it('another user session cannot change the super admin password', async () => {
    const { c } = await login('staff');
    await c.auth.updateUser({ password: 'hijacked-password-123' });
    // the admin password is unchanged by the staff session; staff only ever touches itself
    const { error } = await client().auth.signInWithPassword({
      email: users.admin!.email,
      password: 'hijacked-password-123',
    });
    expect(error).toBeTruthy();
  });

  it('no API route or code path sets another user password', () => {
    const files: string[] = [];
    const walk = (d: string) =>
      readdirSync(d).forEach((f) => {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) files.push(p);
      });
    walk('src');
    walk('scripts');
    for (const f of files) {
      const code = readFileSync(f, 'utf8');
      expect(code, f).not.toMatch(/resetPasswordForEmail|generateLink/);
      // updateUserById is allowed (ban, email replace) but never with a password
      for (const m of code.matchAll(/updateUserById\([^;]*;/g))
        expect(m[0], f).not.toMatch(/password/i);
    }
    const spec = readFileSync('openapi.json', 'utf8');
    expect(spec.toLowerCase()).not.toContain('password');
  });
});
