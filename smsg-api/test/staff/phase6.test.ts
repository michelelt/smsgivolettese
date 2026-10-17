import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  info: new Map<string, { size: number; mime: string }>(),
  removed: [] as string[],
  copied: [] as string[],
}));
vi.mock('../../src/lib/storage.js', () => ({
  signedUpload: vi.fn(async (bucket: string, path: string) => ({
    bucket,
    path,
    token: 't',
    signedUrl: `http://storage.test/${bucket}/${path}`,
  })),
  objectInfo: vi.fn(async (_b: string, p: string) => store.info.get(p) ?? null),
  copyObject: vi.fn(async (_f: string, to: string) => void store.copied.push(to)),
  removeObjects: vi.fn(async (_b: string, p: string[]) => (store.removed.push(...p), p.length)),
  signedReadUrl: vi.fn(async (_b: string, p: string) => `http://storage.test/signed/${p}`),
}));
vi.mock('../../src/lib/turnstile.js', () => ({ verifyTurnstile: vi.fn(async () => true) }));

import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { db } from '../../src/lib/db.js';
import { DB_URL, sql } from '../db/helpers.js';

const tag = Date.now().toString(36);
const mail = (n: string) => `zzb-${n}-${tag}@t.test`;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
const realFetch = globalThis.fetch;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
const uuid = () => crypto.randomUUID();

async function mkUser(key: string, role: string) {
  const id = uuid();
  ids[key] = id;
  await sql`insert into auth.users (id, email, aud, role) values (${id}, ${mail(key)}, 'authenticated', 'authenticated')`;
  await sql`insert into profiles (id, first_name, last_name, email) values (${id}, 'ZZB', ${key}, ${mail(key)})`;
  await sql`insert into user_roles (user_id, role) values (${id}, ${role}::app_role)`;
  tokens[key] = await new SignJWT({ app_role: role })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject(id)
    .setIssuer(`${env.SUPABASE_URL}/auth/v1`)
    .setAudience('authenticated')
    .setExpirationTime('10m')
    .sign(keys.privateKey);
}

async function cleanup() {
  await sql.begin(async (t) => {
    await t`set local session_replication_role = replica`;
    const zu = t`select id from auth.users where email like 'zzb-%@t.test'`;
    await t`delete from posts where title like 'ZZB%'`;
    await t`delete from post_proposals where title like 'ZZB%'`;
    await t`delete from media where uploaded_by in (${zu})`;
    await t`delete from rate_limit_hits where key like 'proposal%:zzb-%'`;
    await t`delete from audit_log where actor_id in (${zu})`;
    await t`delete from user_roles where user_id in (${zu})`;
    await t`delete from profiles where id in (${zu})`;
    await t`delete from auth.users where email like 'zzb-%@t.test'`;
  });
}

beforeAll(async () => {
  const local = (u: string) => ['127.0.0.1', 'localhost'].includes(new URL(u).hostname);
  if (env.DATABASE_URL !== DB_URL || !local(env.DATABASE_URL) || !local(DB_URL))
    throw new Error('phase 6 tests need DATABASE_URL === TEST_DATABASE_URL on 127.0.0.1/localhost');
  keys = await generateKeyPair('ES256');
  await cleanup();
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'ES256' };
  vi.stubGlobal('fetch', (u: string | URL | Request, i?: RequestInit) =>
    String(u).endsWith('jwks.json')
      ? Promise.resolve(Response.json({ keys: [jwk] }))
      : realFetch(u, i),
  );
  await mkUser('staff', 'staff');
  await mkUser('vol', 'volontario');
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanup();
  await db.end();
  await sql.end();
});
beforeEach(() => {
  store.info.clear();
  store.removed.length = 0;
  store.copied.length = 0;
});

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(
  who: string | null,
  method: string,
  path: string,
  body?: unknown,
  h: Record<string, string> = {},
) {
  const res = await app.request(path, {
    method,
    headers: {
      ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...h,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: J = (res.headers.get('content-type') ?? '').includes('json')
    ? await res.json()
    : undefined;
  return { status: res.status, data };
}
const staff = (m: string, p: string, b?: unknown) => call('staff', m, p, b);
const para = (text: string) => ({
  id: 'p1',
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text, styles: {} }],
  children: [],
});
const ip = (n: string) => ({ 'x-real-ip': `zzb-${n}-${tag}` });

describe('permissions', () => {
  it('guards staff routes', async () => {
    expect((await call(null, 'GET', '/posts')).status).toBe(401);
    expect((await call('vol', 'GET', '/posts')).status).toBe(403);
    expect(
      (
        await call('vol', 'POST', '/media/upload-url', {
          kind: 'image',
          mime: 'image/png',
          size: 1,
        })
      ).status,
    ).toBe(403);
    expect((await call('vol', 'GET', '/proposals')).status).toBe(403);
  });
});

describe('posts lifecycle', () => {
  it('creates, validates, publishes, freezes the slug, unpublishes and deletes', async () => {
    const c = await staff('POST', '/posts', {
      title: 'ZZB Gita à Torino',
      category: 'evento',
      content: [para('Ciao   mondo')],
    });
    expect(c.data, JSON.stringify(c.data)).toBeTruthy();
    expect(c.status, JSON.stringify(c.data)).toBe(201);
    expect(c.data).toMatchObject({
      status: 'bozza',
      slug: 'zzb-gita-a-torino',
      excerpt: 'Ciao mondo',
    });
    const id = c.data.id;

    expect((await staff('POST', `/posts/${id}/publish`)).data.error.code).toBe(
      'EVENT_DATE_REQUIRED',
    );
    expect(
      (
        await staff('PATCH', `/posts/${id}`, {
          content: [{ id: 'x', type: 'script', props: {}, children: [] }],
        })
      ).status,
    ).toBe(400);
    const missing = `2026/${uuid()}.webp`;
    const img = { id: 'i', type: 'image', props: { url: missing }, children: [] };
    expect((await staff('PATCH', `/posts/${id}`, { content: [img] })).data.error.code).toBe(
      'MEDIA_NOT_FOUND',
    );

    // same title while still a draft: collision gets -2, and the slug follows the title
    const d = await staff('POST', '/posts', { title: 'ZZB Gita à Torino', category: 'notizia' });
    expect(d.data.slug).toBe('zzb-gita-a-torino-2');
    const r = await staff('PATCH', `/posts/${id}`, {
      title: 'ZZB Gita a Pinerolo',
      eventDate: '2099-01-01',
    });
    expect(r.data.slug).toBe('zzb-gita-a-pinerolo');

    const p = await staff('POST', `/posts/${id}/publish`);
    expect(p.status).toBe(200);
    expect(p.data.publishedAt).toBeTruthy();
    expect((await staff('POST', `/posts/${id}/publish`)).data.error.code).toBe(
      'POST_INVALID_TRANSITION',
    );
    expect((await call(null, 'GET', `/public/posts/${p.data.slug}`)).data.title).toBe(
      'ZZB Gita a Pinerolo',
    );
    expect((await staff('PATCH', `/posts/${id}`, { title: 'ZZB Altro titolo' })).data.slug).toBe(
      'zzb-gita-a-pinerolo',
    );

    const u = await staff('POST', `/posts/${id}/unpublish`);
    expect(u.data.status).toBe('bozza');
    expect(u.data.publishedAt).toBe(p.data.publishedAt);
    expect((await call(null, 'GET', '/public/posts/zzb-gita-a-pinerolo')).data.error.code).toBe(
      'POST_NOT_FOUND',
    );
    expect((await staff('POST', `/posts/${id}/unpublish`)).status).toBe(409);

    expect((await staff('DELETE', `/posts/${id}`)).status).toBe(204);
    expect((await staff('GET', `/posts/${id}`)).data.error.code).toBe('POST_NOT_FOUND');
    const l = await staff('GET', '/posts?q=ZZB&status=bozza');
    expect(l.data.total).toBe(1);
  });

  it('serves seeded public content', async () => {
    const l = await call(null, 'GET', '/public/posts?pageSize=24');
    expect(l.data.items.some((x: J) => x.slug === 'festa-di-esempio')).toBe(true);
    const up = await call(null, 'GET', '/public/posts?upcoming=true&pageSize=3');
    expect(up.data.items.every((x: J) => x.category === 'evento')).toBe(true);
    const f = await call(null, 'GET', '/public/posts/festa-di-esempio');
    expect(f.data.content.length).toBeGreaterThan(5);
    expect((await call(null, 'GET', '/public/gallery')).status).toBe(200);
  });
});

describe('media', () => {
  it('limits sizes and verifies uploads', async () => {
    const big = await staff('POST', '/media/upload-url', {
      kind: 'image',
      mime: 'image/webp',
      size: 11 * 1024 * 1024,
    });
    expect(big.data.error).toMatchObject({ code: 'FILE_TOO_LARGE', details: { maxMb: 10 } });
    const vid = await staff('POST', '/media/upload-url', {
      kind: 'video',
      mime: 'video/mp4',
      size: 51 * 1024 * 1024,
    });
    expect(vid.data.error.code).toBe('FILE_TOO_LARGE');
    expect(
      (await staff('POST', '/media/upload-url', { kind: 'video', mime: 'image/png', size: 1 }))
        .status,
    ).toBe(400);
    const ok = await staff('POST', '/media/upload-url', {
      kind: 'image',
      mime: 'image/jpeg',
      size: 1000,
    });
    expect(ok.status).toBe(200);
    expect(ok.data.path).toMatch(/^\d{4}\/[0-9a-f-]{36}\.jpg$/);

    const path = ok.data.path;
    expect((await staff('POST', '/media/complete', { path })).data.error.code).toBe(
      'UPLOAD_NOT_FOUND',
    );
    store.info.set(path, { size: 10, mime: 'image/png' }); // extension says jpg
    expect((await staff('POST', '/media/complete', { path })).data.error.code).toBe(
      'UPLOAD_INVALID',
    );
    expect(store.removed).toContain(path);
    store.info.set(path, { size: 10, mime: 'image/jpeg' });
    const done = await staff('POST', '/media/complete', {
      path,
      width: 800,
      height: 600,
      alt: 'Foto',
    });
    expect(done.status).toBe(201);
    expect(done.data).toMatchObject({ path, mime: 'image/jpeg', width: 800, alt: 'Foto' });

    // usable as cover and in content
    const post = await staff('POST', '/posts', {
      title: 'ZZB Con foto',
      category: 'avviso',
      coverMediaId: done.data.id,
      content: [{ id: 'i', type: 'image', props: { url: path }, children: [] }],
    });
    expect(post.status).toBe(201);
    expect(post.data.cover.path).toBe(path);
    expect(post.data.media).toHaveLength(1);
  });
});

describe('proposals', () => {
  const body = (n: string, extra: object = {}) => ({
    title: `ZZB Proposta ${n}`,
    category: 'notizia',
    body: 'Primo paragrafo\n\nSecondo',
    submitterName: 'Mario',
    turnstileToken: 'ok',
    ...extra,
  });

  it('rate limits and validates the photo', async () => {
    const h = ip('rl');
    expect(
      (await call(null, 'POST', '/public/proposals', body('x', { photoPath: `${uuid()}.png` }), h))
        .data.error.code,
    ).toBe('UPLOAD_NOT_FOUND');
    for (let i = 0; i < 2; i++)
      expect((await call(null, 'POST', '/public/proposals', body('rl'), h)).status).toBe(201);
    expect((await call(null, 'POST', '/public/proposals', body('rl'), h)).status).toBe(429);
    expect(
      (
        await call(
          null,
          'POST',
          '/public/proposals',
          { ...body('v'), videoUrl: 'http://x' },
          ip('v'),
        )
      ).status,
    ).toBe(400);
    const up = await call(
      null,
      'POST',
      '/public/proposals/upload-url',
      { mime: 'image/png', size: 6 * 1024 * 1024 },
      ip('u'),
    );
    expect(up.data.error.code).toBe('FILE_TOO_LARGE');
    const ok = await call(
      null,
      'POST',
      '/public/proposals/upload-url',
      { mime: 'image/png', size: 1000 },
      ip('u'),
    );
    expect(ok.data.bucket).toBe('proposals');
  });

  it('drafts, publishes and rejects', async () => {
    const photoPath = `${uuid()}.png`;
    store.info.set(photoPath, { size: 100, mime: 'image/png' });
    const sub = await call(
      null,
      'POST',
      '/public/proposals',
      body('pub', { photoPath, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }),
      ip('a'),
    );
    expect(sub.status).toBe(201);
    const pid = sub.data.id;

    const l = await staff('GET', '/proposals?pageSize=100');
    expect(l.data.items.find((x: J) => x.id === pid)).toMatchObject({
      status: 'attesa',
      hasPhoto: true,
    });
    expect((await staff('GET', `/proposals/${pid}`)).data.photoUrl).toContain(photoPath);

    const d1 = await staff('POST', `/proposals/${pid}/draft`);
    expect(d1.status).toBe(201);
    expect(d1.data).toMatchObject({ status: 'bozza', fromProposalId: pid });
    expect(d1.data.cover.path).toMatch(/^\d{4}\/.*\.png$/);
    expect(d1.data.content.map((b: J) => b.type)).toEqual([
      'paragraph',
      'paragraph',
      'image',
      'video',
    ]);
    expect(store.copied).toHaveLength(1);
    const d2 = await staff('POST', `/proposals/${pid}/draft`);
    expect(d2.status).toBe(200);
    expect(d2.data.id).toBe(d1.data.id);
    expect(store.copied).toHaveLength(1);

    const pub = await staff('POST', `/proposals/${pid}/publish`);
    expect(pub.status).toBe(200);
    expect(pub.data.status).toBe('pubblicata');
    expect((await staff('GET', `/proposals/${pid}`)).data.status).toBe('pubblicata');
    expect((await staff('POST', `/proposals/${pid}/reject`)).data.error.code).toBe(
      'PROPOSAL_INVALID_TRANSITION',
    );

    const s2 = await call(
      null,
      'POST',
      '/public/proposals',
      body('rej', {
        photoPath: (() => {
          const p = `${uuid()}.jpg`;
          store.info.set(p, { size: 5, mime: 'image/jpeg' });
          return p;
        })(),
      }),
      ip('b'),
    );
    const rj = await staff('POST', `/proposals/${s2.data.id}/reject`);
    expect(rj.data).toMatchObject({ status: 'rifiutata', photoUrl: null });
    expect(store.removed).toHaveLength(1);
    expect((await staff('POST', `/proposals/${s2.data.id}/draft`)).status).toBe(409);
    expect((await staff('GET', `/proposals/${uuid()}`)).data.error.code).toBe('PROPOSAL_NOT_FOUND');
  });

  it('reject removes the draft post, its media row and object', async () => {
    const photoPath = `${uuid()}.png`;
    store.info.set(photoPath, { size: 100, mime: 'image/png' });
    const sub = await call(null, 'POST', '/public/proposals', body('rjd', { photoPath }), ip('c'));
    const d = await staff('POST', `/proposals/${sub.data.id}/draft`);
    expect(d.status).toBe(201);
    store.removed.length = 0;
    const rj = await staff('POST', `/proposals/${sub.data.id}/reject`);
    expect(rj.data).toMatchObject({ status: 'rifiutata', postId: null });
    expect(store.removed).toEqual([photoPath, d.data.cover.path]);
    expect((await staff('GET', `/posts/${d.data.id}`)).status).toBe(404);
    expect(await sql`select 1 from media where path = ${d.data.cover.path}`).toHaveLength(0);
  });

  it('cron anonymises reviewed proposals after 90 days and drops their photo', async () => {
    const photoPath = `${uuid()}.png`;
    store.info.set(photoPath, { size: 100, mime: 'image/png' });
    const mk = async (n: string, extra: object) =>
      (
        await call(
          null,
          'POST',
          '/public/proposals',
          body(n, { submitterContact: 'a@b.it', ...extra }),
          ip(n),
        )
      ).data.id as string;
    const old = await mk('cr1', { photoPath });
    const fresh = await mk('cr2', {});
    const waiting = await mk('cr3', {});
    await staff('POST', `/proposals/${old}/reject`);
    await staff('POST', `/proposals/${fresh}/reject`);
    await sql`update post_proposals set reviewed_at = now() - interval '91 days' where id = ${old}`;
    await sql`update post_proposals set created_at = now() - interval '200 days' where id = ${waiting}`;
    env.CRON_SECRET = 'cron-secret-for-tests-0123';
    const r = await app.request('/cron/daily', {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    expect((await r.json()).proposalsAnonymised).toBeGreaterThanOrEqual(1);
    const rows = await sql`select id, submitter_name n, submitter_contact c, photo_path p
      from post_proposals where id in ${sql([old, fresh, waiting])}`;
    const by = (id: string) => rows.find((x) => x.id === id)!;
    expect(by(old)).toMatchObject({ n: 'Anonimo', c: null, p: null });
    expect(by(fresh)).toMatchObject({ n: 'Mario', c: 'a@b.it' });
    expect(by(waiting)).toMatchObject({ n: 'Mario', c: 'a@b.it' });
  });
});
