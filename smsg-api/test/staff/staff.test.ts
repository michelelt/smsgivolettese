import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const revalidate = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../src/lib/revalidate.js', () => ({ revalidate }));

import { app } from '../../src/app.js';
import { db } from '../../src/lib/db.js';
import { env } from '../../src/config/env.js';
import { DB_URL, sql } from '../db/helpers.js';

const tag = Date.now().toString(36);
const STAFF = crypto.randomUUID();
const VOL = crypto.randomUUID();
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
const realFetch = globalThis.fetch;
const tokens: Record<string, string> = {};
const year = Number(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date()),
);
let counters0: { year: number; last_number: number }[];
let card0: number;
let site0: Record<string, unknown>;

async function token(sub: string, role: string) {
  return new SignJWT({ app_role: role })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject(sub)
    .setIssuer(`${env.SUPABASE_URL}/auth/v1`)
    .setAudience('authenticated')
    .setExpirationTime('10m')
    .sign(keys.privateKey);
}

beforeAll(async () => {
  // the app writes via DATABASE_URL, cleanup via TEST_DATABASE_URL: both must be the same local DB
  const local = (u: string) => ['127.0.0.1', 'localhost'].includes(new URL(u).hostname);
  if (env.DATABASE_URL !== DB_URL || !local(env.DATABASE_URL) || !local(DB_URL))
    throw new Error('staff tests need DATABASE_URL === TEST_DATABASE_URL on 127.0.0.1/localhost');
  await cleanup(false); // residue of crashed runs, before snapshotting
  keys = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'ES256' };
  vi.stubGlobal('fetch', (u: string | URL | Request, i?: RequestInit) =>
    String(u).endsWith('jwks.json')
      ? Promise.resolve(Response.json({ keys: [jwk] }))
      : realFetch(u, i),
  );
  tokens.staff = await token(STAFF, 'staff');
  tokens.vol = await token(VOL, 'volontario');
  for (const [id, n, r] of [
    [STAFF, 'staff', 'staff'],
    [VOL, 'vol', 'volontario'],
  ] as const) {
    await sql`insert into auth.users (id, email, aud, role) values (${id}, ${`zzt-${n}-${tag}@t.test`}, 'authenticated', 'authenticated')`;
    await sql`insert into profiles (id, first_name, last_name, email) values (${id}, 'ZZT', ${n}, ${`zzt-${n}-${tag}@t.test`})`;
    await sql`insert into user_roles (user_id, role) values (${id}, ${r}::app_role)`;
  }
  counters0 = await sql`select year, last_number from invoice_counters`;
  card0 = (await sql`select last_card_number from org_settings`)[0]!.last_card_number;
  site0 = (
    await sql`select address, slogan, home_intro, vat_number, conventions, footer_links from site_settings`
  )[0]!;
});

async function cleanup(restore: boolean) {
  await sql.begin(async (t) => {
    await t`set local session_replication_role = replica`; // bypass immutability/audit triggers for cleanup
    const zc = t`select id from members where first_name = 'ZZT'`;
    const zu = t`select id from auth.users where email like 'zzt-%@t.test'`;
    await t`delete from transports where member_id in (${zc})`;
    await t`delete from invoice_lines where invoice_id in (select id from invoices where member_id in (${zc}))`;
    await t`delete from invoices where member_id in (${zc})`;
    await t`delete from bookings where member_id in (${zc})`;
    await t`delete from membership_fees where member_id in (select id from members where first_name = 'ZZT')`;
    await t`delete from members where first_name = 'ZZT'`;
    await t`delete from services where name like 'ZZT%'`;
    // audit_log is append-only (ADR-066): test rows are left behind, queries filter by request_id/actor
    if (restore) {
      await t`delete from invoice_counters`;
      for (const c of counters0)
        await t`insert into invoice_counters (year, last_number) values (${c.year}, ${c.last_number})`;
      await t`update org_settings set last_card_number = ${card0}`;
      await t`update site_settings set address = ${site0.address as string | null}, slogan = ${site0.slogan as string | null},
        home_intro = ${site0.home_intro as string | null}, vat_number = ${site0.vat_number as string | null},
        conventions = ${sql.json(site0.conventions as never)}, footer_links = ${sql.json(site0.footer_links as never)}`;
    }
    await t`delete from user_roles where user_id in (${zu})`;
    await t`delete from profiles where id in (${zu})`;
    await t`delete from auth.users where email like 'zzt-%@t.test'`;
  });
}

afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanup(true);
  await db.end();
  await sql.end();
});

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(
  who: 'staff' | 'vol' | null,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const res = await app.request(path, {
    method,
    headers: {
      ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ct = res.headers.get('content-type') ?? '';
  const data: J = ct.includes('json') ? await res.json() : undefined;
  return { res, status: res.status, data };
}
const staff = (m: string, p: string, b?: unknown, h?: Record<string, string>) =>
  call('staff', m, p, b, h);

let n = 0;
const mkMember = async (extra: object = {}) =>
  (
    await staff('POST', '/members', {
      firstName: 'ZZT',
      lastName: `C${tag}${n++}`,
      phone: '3330000000',
      ...extra,
    })
  ).data;
const mkService = async (price: number, extra: object = {}) =>
  (
    await staff('POST', '/services', {
      name: `ZZT s${n++} ${tag}`,
      priceCents: price,
      ...extra,
    })
  ).data;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const mkDone = async (memberId: string, serviceId: string) => {
  const b = (await staff('POST', '/bookings', { memberId, serviceId, day: today, slot: 'mattina' }))
    .data;
  expect((await staff('POST', `/bookings/${b.id}/execute`)).status).toBe(200);
  return b.id as string;
};
let taxN = 0;
const fakeTax = () =>
  `ZZ${tag.toUpperCase().padEnd(6, '0').slice(0, 6)}${String(taxN++).padStart(8, '0')}`.slice(
    0,
    16,
  );

describe('permissions', () => {
  const routes: [string, string][] = [
    ['GET', '/bookings'],
    ['POST', '/bookings'],
    ['GET', '/bookings/kpis'],
    ['GET', '/members'],
    ['GET', '/members/export.csv'],
    ['POST', '/members'],
    ['GET', '/invoices'],
    ['POST', '/invoices'],
    ['GET', '/invoices/export.csv'],
    ['GET', '/services'],
    ['POST', '/services'],
    ['PUT', '/site-settings'],
    ['GET', '/org-info'],
  ];
  for (const [m, p] of routes)
    it(`${m} ${p}: anonymous 401, volunteer 403`, async () => {
      expect((await call(null, m, p, m === 'GET' ? undefined : {})).status).toBe(401);
      expect((await call('vol', m, p, m === 'GET' ? undefined : {})).status).toBe(403);
    });
});

describe('services and settings', () => {
  it('creates, lists and patches services, revalidating the cache', async () => {
    revalidate.mockClear();
    const s = await mkService(2500);
    expect(s).toMatchObject({ priceCents: 2500, active: true });
    expect(revalidate).toHaveBeenCalledWith(['services']);
    const p = await staff('PATCH', `/services/${s.id}`, { active: false });
    expect(p.data.active).toBe(false);
    expect(((await staff('GET', '/services')).data.items as J[]).some((x) => x.id === s.id)).toBe(
      true,
    );
    expect(
      (await staff('PATCH', `/services/${crypto.randomUUID()}`, { active: true })).status,
    ).toBe(404);
    expect((await staff('PATCH', `/services/${s.id}`, {})).status).toBe(400);
    expect((await staff('POST', '/services', { name: '', priceCents: -1 })).status).toBe(400);
  });
  it('PUT /site-settings validates and revalidates; org-info is readable', async () => {
    revalidate.mockClear();
    const ok = {
      address: 'Via Test 1',
      slogan: null,
      homeIntro: 'Ciao',
      vatNumber: '12345678901',
      conventions: [{ title: 'Conv', description: 'd', url: 'https://example.org' }],
      footerLinks: [{ group: 'utili', label: 'L', url: 'https://example.org/x' }],
      pages: (await (await app.request('/public/site-settings')).json()).pages as J,
    };
    const r = await staff('PUT', '/site-settings', ok);
    expect(r.status).toBe(200);
    expect(revalidate).toHaveBeenCalledWith(['site-settings']);
    const pub = (await (await app.request('/public/site-settings')).json()) as J;
    expect(pub.conventions).toHaveLength(1);
    expect(pub.pages).toEqual(ok.pages);
    const sec = { heading: 'H', body: 'B' };
    const pg = (k: string, v: unknown) => ({ ...ok, pages: { ...ok.pages, [k]: v } });
    const chi = ok.pages.chiSiamo as J;
    const bad = [
      { ...ok, footerLinks: [{ group: 'utili', label: 'L', url: 'http://x.org' }] },
      { ...ok, vatNumber: '123' },
      { ...ok, conventions: Array.from({ length: 51 }, () => ok.conventions[0]) },
      { ...ok, footerLinks: [{ group: 'altro', label: 'L', url: 'https://x.org' }] },
      { ...ok, extra: 1 },
      { ...ok, pages: undefined },
      pg('chiSiamo', { ...chi, extra: 1 }),
      pg('servizi', { title: '', intro: '' }),
      pg('chiSiamo', { ...chi, sections: Array.from({ length: 21 }, () => sec) }),
      pg('privacy', { ...chi, sections: [{ heading: 'H', body: 'x'.repeat(5001) }] }),
    ];
    for (const b of bad) expect((await staff('PUT', '/site-settings', b)).status).toBe(400);
    const o = (await staff('GET', '/org-info')).data;
    expect(o.nextCardNumber).toBe(
      (await sql`select last_card_number + 1 as n from org_settings`)[0]!.n,
    );
  });
});

describe('members', () => {
  it('validates tax codes: 400 shape, 422 checksum, confirmed ok, valid ok', async () => {
    const base = { firstName: 'ZZT', lastName: `T${tag}`, phone: '333' };
    const short = await staff('POST', '/members', { ...base, taxCode: 'ABC' });
    expect(short.status).toBe(400);
    const bad = await staff('POST', '/members', { ...base, taxCode: 'RSSMRA85T10A562T' });
    expect(bad.status).toBe(422);
    expect(bad.data.error).toMatchObject({
      code: 'TAX_CODE_INVALID',
      details: { field: 'taxCode' },
    });
    const conf = await staff('POST', '/members', {
      ...base,
      taxCode: 'rssmra85t10a562t',
      taxCodeConfirmed: true,
    });
    expect(conf.status).toBe(201);
    expect(conf.data.taxCode).toBe('RSSMRA85T10A562T');
    const okc = await staff('POST', '/members', { ...base, taxCode: ' RSSMRA85T10A562S ' });
    expect(okc.status).toBe(201);
    const omo = await staff('POST', '/members', { ...base, taxCode: 'RSSMRA85T10A56NS' });
    expect(omo.status).toBe(422); // layout fine, check character is the plain code's
  });

  it('registers a member: card number, fee, audit, duplicates, link, patch, lists', async () => {
    const before = (await staff('GET', '/org-info')).data.nextCardNumber;
    const tc = fakeTax();
    const rid = `rid-${tag}-m`;
    const r = await staff(
      'POST',
      '/members',
      {
        firstName: 'ZZT',
        lastName: `M${tag}`,
        taxCode: tc,
        taxCodeConfirmed: true,
        feeMethod: 'contanti',
      },
      { 'x-request-id': rid },
    );
    expect(r.status).toBe(201);
    expect(r.data.cardNumber).toBe(before);
    expect(r.data.feePaidCurrentYear).toBe(true);
    expect(r.data.fees).toHaveLength(1);
    expect(r.data).toMatchObject({ bookings: [], transports: [], invoices: [] });

    const dup = await staff('POST', '/members', {
      firstName: 'ZZT',
      lastName: 'X',
      taxCode: tc,
      taxCodeConfirmed: true,
    });
    expect(dup.status).toBe(409);
    expect(dup.data.error.code).toBe('MEMBER_TAX_CODE_EXISTS');
    expect(
      (await staff('POST', '/members', { firstName: 'ZZT', lastName: 'Y', clientId: 'x' })).status,
    ).toBe(400);
    // the failed registration rolled back, so the card number was not burned
    expect((await staff('GET', '/org-info')).data.nextCardNumber).toBe(before + 1);

    const id = r.data.id;
    const p = await staff(
      'PATCH',
      `/members/${id}`,
      { city: 'Givoletto', postalCode: '10040' },
      { 'x-request-id': `${rid}-p` },
    );
    expect(p.data).toMatchObject({ city: 'Givoletto', cardNumber: before });
    expect((await staff('PATCH', `/members/${id}`, { cardNumber: 1 })).status).toBe(400);
    expect((await staff('PATCH', `/members/${id}`, { postalCode: '1' })).status).toBe(400);
    expect((await staff('PATCH', `/members/${crypto.randomUUID()}`, { city: 'x' })).status).toBe(
      404,
    );

    const audit =
      await sql`select table_name, action from audit_log where request_id in (${rid}, ${rid + '-p'}) and actor_id = ${STAFF}`;
    const has = (t: string, a: string) => audit.some((x) => x.table_name === t && x.action === a);
    expect(
      has('members', 'insert') && has('members', 'update') && has('membership_fees', 'insert'),
    ).toBe(true);

    const q = (await staff('GET', `/members?filter=tutti&q=M${tag}`)).data;
    expect(q.total).toBe(1);
    expect((await staff('GET', '/members/kpis')).data.active).toBeGreaterThan(0);
    expect((await staff('GET', `/members/${id}`)).data.fees).toHaveLength(1);
    expect((await staff('GET', `/members/${crypto.randomUUID()}`)).status).toBe(404);
    expect((await staff('GET', `/members?page=0`)).status).toBe(400);
  });

  it('member transitions, fees, receipt and CSV', async () => {
    const tag2 = `T${tag}`;
    const m = (
      await staff('POST', '/members', {
        firstName: 'ZZT',
        lastName: `=cmd${tag2}`,
        phone: '+39333',
      })
    ).data;
    expect(m.feePaidCurrentYear).toBe(false);
    expect(
      ((await staff('GET', `/members?filter=da_rinnovare&q=cmd${tag2}`)).data.items as J[]).length,
    ).toBe(1);

    // fees: defaults, duplicate, other year
    const rid = `rid-${tag}-fee`;
    const f = await staff(
      'POST',
      `/members/${m.id}/fees`,
      { method: 'pos' },
      { 'x-request-id': rid },
    );
    expect(f.status).toBe(201);
    expect(f.data).toMatchObject({
      year,
      amountCents: (await staff('GET', '/org-info')).data.membershipFeeCents,
      method: 'pos',
      paidOn: today,
    });
    const futFee = await staff('POST', `/members/${m.id}/fees`, {
      method: 'pos',
      year: year - 5,
      paidOn: `${year + 1}-01-01`,
    });
    expect([futFee.status, futFee.data.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    const dup = await staff('POST', `/members/${m.id}/fees`, { method: 'pos' });
    expect([dup.status, dup.data.error.code]).toEqual([409, 'FEE_ALREADY_PAID']);
    expect(
      (
        await staff('POST', `/members/${m.id}/fees`, {
          method: 'bonifico',
          year: year - 1,
          amountCents: 1500,
        })
      ).status,
    ).toBe(201);
    expect(
      (await staff('POST', `/members/${crypto.randomUUID()}/fees`, { method: 'pos' })).status,
    ).toBe(404);
    expect(
      (
        await sql`select 1 from audit_log where request_id = ${rid} and table_name = 'membership_fees'`
      ).length,
    ).toBe(1);

    const pdf = await staff('GET', `/members/${m.id}/fees/${f.data.id}/receipt.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.res.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.res.headers.get('content-disposition')).toContain('attachment');
    expect(pdf.res.headers.get('cache-control')).toBe('no-store');
    expect(
      Buffer.from(await pdf.res.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
    expect(
      (await staff('GET', `/members/${m.id}/fees/${crypto.randomUUID()}/receipt.pdf`)).status,
    ).toBe(404);

    // end / reactivate
    expect((await staff('POST', `/members/${m.id}/reactivate`)).data.error.code).toBe(
      'MEMBER_INVALID_TRANSITION',
    );
    const e = await staff('POST', `/members/${m.id}/end`, { endReason: 'dimissioni' });
    expect(e.data).toMatchObject({ status: 'cessato', endedOn: today, endReason: 'dimissioni' });
    const e2 = await staff('POST', `/members/${m.id}/end`, { endReason: 'decesso' });
    expect([e2.status, e2.data.error.code]).toEqual([409, 'MEMBER_INVALID_TRANSITION']);
    expect((await staff('GET', `/members?filter=cessati&q=cmd${tag2}`)).data.total).toBe(1);
    expect((await staff('POST', `/members/${m.id}/reactivate`)).data).toMatchObject({
      status: 'attivo',
      endedOn: null,
      endReason: null,
    });
    expect(
      (await staff('POST', `/members/${crypto.randomUUID()}/end`, { endReason: 'decesso' })).status,
    ).toBe(404);

    // csv
    const c = await staff('GET', '/members/export.csv');
    expect(c.status).toBe(200);
    expect(c.res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(c.res.headers.get('content-disposition')).toContain(`libro-soci-${today}.csv`);
    const raw = Buffer.from(await c.res.arrayBuffer());
    expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // text() would strip the BOM
    const text = raw.toString('utf8');
    expect(text.startsWith('﻿"Tessera";"Cognome"')).toBe(true);
    expect(text).toContain(`"'=cmd${tag2}"`);
    expect(text).toContain('"+39333"'); // phone: not guarded
    expect(text).toContain('\r\n');
    expect(text).toContain(`"Quota ${year}"`);
  });

  it('member detail lists bookings, transports and invoices; q matches name, card, tax code, phone', async () => {
    const tc = fakeTax();
    const m = await mkMember({ taxCode: tc, taxCodeConfirmed: true, phone: `339${tag}` });
    const svc = await mkService(1500);
    const b = await mkDone(m.id, svc.id);
    const inv = (await staff('POST', '/invoices', { memberId: m.id, bookingIds: [b] })).data;
    const t = (await staff('POST', '/transports', { memberId: m.id, travelDate: today })).data;
    const d = (await staff('GET', `/members/${m.id}`)).data;
    expect(d.bookings.map((x: J) => x.id)).toEqual([b]);
    expect(d.bookings[0]).toMatchObject({
      memberId: m.id,
      invoiceId: inv.id,
      priceAppliedCents: 1500,
    });
    expect(d.transports.map((x: J) => x.id)).toEqual([t.id]);
    expect(d.invoices.map((x: J) => x.id)).toEqual([inv.id]);
    for (const q of [m.lastName, String(m.cardNumber), tc, `339${tag}`])
      expect(
        ((await staff('GET', `/members?q=${encodeURIComponent(q)}`)).data.items as J[]).map(
          (x) => x.id,
        ),
      ).toContain(m.id);
    expect((await staff('GET', `/members/${crypto.randomUUID()}`)).status).toBe(404);
    expect((await staff('GET', `/clients`)).status).toBe(404);
  });
});

describe('bookings', () => {
  it('snapshots the service price, status by time, 422 for a cessato member', async () => {
    const svc = await mkService(2500);
    const plain = await mkMember();
    const m = await mkMember();
    const day = '2031-05-06';
    const b1 = await staff('POST', '/bookings', {
      memberId: plain.id,
      serviceId: svc.id,
      day,
      slot: 'mattina',
    });
    expect(b1.status).toBe(201);
    expect(b1.data).toMatchObject({
      memberId: plain.id,
      priceAppliedCents: 2500,
      status: 'attesa',
      origin: 'telefono',
      time: null,
    });
    expect(b1.data).not.toHaveProperty('isMember');
    const b2 = await staff('POST', '/bookings', {
      memberId: m.id,
      serviceId: svc.id,
      day,
      slot: 'pomeriggio',
      time: '15:30',
    });
    expect(b2.data).toMatchObject({ status: 'confermata', time: '15:30' });
    expect(
      (
        await staff('POST', '/bookings', {
          memberId: m.id,
          serviceId: svc.id,
          day,
          slot: 'mattina',
          declaredMember: true,
        })
      ).status,
    ).toBe(400);
    // cessato member: no new bookings or transports, existing ones stay
    await staff('POST', `/members/${m.id}/end`, { endReason: 'dimissioni' });
    const ended = await staff('POST', '/bookings', {
      memberId: m.id,
      serviceId: svc.id,
      day,
      slot: 'mattina',
    });
    expect([ended.status, ended.data.error.code]).toEqual([422, 'MEMBER_NOT_ACTIVE']);
    const endedT = await staff('POST', '/transports', { memberId: m.id, travelDate: day });
    expect([endedT.status, endedT.data.error.code]).toEqual([422, 'MEMBER_NOT_ACTIVE']);
    expect((await staff('POST', `/bookings/${b2.data.id}/execute`)).status).toBe(200);
    // price changes do not touch existing bookings
    await staff('PATCH', `/services/${svc.id}`, { priceCents: 9999 });
    expect(
      ((await staff('GET', `/bookings?memberId=${plain.id}&status=tutte`)).data.items as J[])[0]
        .priceAppliedCents,
    ).toBe(2500);

    expect(
      (
        await staff('POST', '/bookings', {
          memberId: plain.id,
          serviceId: svc.id,
          day: 'x',
          slot: 'mattina',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await staff('POST', '/bookings', {
          memberId: plain.id,
          serviceId: svc.id,
          day,
          slot: 'mattina',
          time: '25:00',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await staff('POST', '/bookings', {
          memberId: plain.id,
          serviceId: svc.id,
          day,
          slot: 'mattina',
          notes: 'x'.repeat(601),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await staff('POST', '/bookings', {
          memberId: crypto.randomUUID(),
          serviceId: svc.id,
          day,
          slot: 'mattina',
        })
      ).data.error.code,
    ).toBe('MEMBER_NOT_FOUND');
    expect(
      (
        await staff('POST', '/bookings', {
          memberId: plain.id,
          serviceId: crypto.randomUUID(),
          day,
          slot: 'mattina',
        })
      ).status,
    ).toBe(404);

    await staff('PATCH', `/services/${svc.id}`, { active: false });
    const off = await staff('POST', '/bookings', {
      memberId: plain.id,
      serviceId: svc.id,
      day,
      slot: 'mattina',
    });
    expect([off.status, off.data.error.code]).toEqual([422, 'SERVICE_INACTIVE']);
  });

  it('walks every transition and rejects the others with 409', async () => {
    const svc = await mkService(100);
    const c = await mkMember();
    const mk = async () =>
      (
        await staff('POST', '/bookings', {
          memberId: c.id,
          serviceId: svc.id,
          day: '2031-06-01',
          slot: 'mattina',
        })
      ).data.id as string;
    const act = (id: string, verb: string, b?: unknown) =>
      staff('POST', `/bookings/${id}/${verb}`, b);
    const inval = (r: { status: number; data: J }) => [r.status, r.data.error?.code];

    const a = await mk();
    expect((await act(a, 'confirm', { time: '09:15' })).data).toMatchObject({
      status: 'confermata',
      time: '09:15',
    });
    expect(inval(await act(a, 'confirm', {}))).toEqual([409, 'BOOKING_INVALID_TRANSITION']);
    expect(inval(await act(a, 'restore'))).toEqual([409, 'BOOKING_INVALID_TRANSITION']);
    const ex = await act(a, 'execute');
    expect(ex.data.status).toBe('eseguita');
    for (const v of ['execute', 'confirm', 'restore'] as const)
      expect(inval(await act(a, v))).toEqual([409, 'BOOKING_INVALID_TRANSITION']);
    expect(inval(await act(a, 'cancel', { by: 'staff' }))).toEqual([
      409,
      'BOOKING_INVALID_TRANSITION',
    ]);

    const b = await mk();
    expect((await act(b, 'confirm')).data).toMatchObject({ status: 'confermata', time: null }); // no body, time optional
    expect((await act(b, 'cancel', { by: 'utente' })).data).toMatchObject({
      status: 'annullata',
      cancelledBy: 'utente',
    });
    for (const v of ['execute', 'confirm'] as const)
      expect(inval(await act(b, v))).toEqual([409, 'BOOKING_INVALID_TRANSITION']);
    expect(inval(await act(b, 'cancel', { by: 'staff' }))).toEqual([
      409,
      'BOOKING_INVALID_TRANSITION',
    ]);
    expect((await act(b, 'restore')).data).toMatchObject({ status: 'attesa', cancelledBy: null });
    expect(inval(await act(b, 'restore'))).toEqual([409, 'BOOKING_INVALID_TRANSITION']);
    expect((await act(b, 'cancel', { by: 'invalid' })).status).toBe(400);

    const d = await mk();
    expect((await act(d, 'execute')).data.status).toBe('eseguita'); // straight from attesa
    expect((await act(crypto.randomUUID(), 'execute')).status).toBe(404);
    expect((await act('not-a-uuid', 'execute')).status).toBe(400);
  });

  it('cancel and restore sync the linked transport (ADR-046)', async () => {
    const svc = await mkService(100, { requiresTransport: true });
    const c = await mkMember();
    const id = (
      await staff('POST', '/bookings', {
        memberId: c.id,
        serviceId: svc.id,
        day: '2031-07-01',
        slot: 'mattina',
      })
    ).data.id;
    const st = async () =>
      (await sql`select status from transports where booking_id = ${id}`)[0]!.status;
    expect(await st()).toBe('richiesto');
    await staff('POST', `/bookings/${id}/cancel`, { by: 'staff' });
    expect(await st()).toBe('annullato');
    await staff('POST', `/bookings/${id}/restore`);
    expect(await st()).toBe('richiesto');
  });

  it('lists with filters and kpis', async () => {
    const svc = await mkService(100);
    const c = await mkMember();
    const id = (
      await staff('POST', '/bookings', {
        memberId: c.id,
        serviceId: svc.id,
        day: '2031-08-01',
        slot: 'mattina',
        time: '10:00',
      })
    ).data.id;
    const list = (qs: string) => staff('GET', `/bookings?memberId=${c.id}&${qs}`);
    expect((await list('')).data.total).toBe(1); // default aperte
    expect((await list('status=attesa')).data.total).toBe(0);
    expect((await list('status=confermata')).data.total).toBe(1);
    expect((await list('status=da_fatturare')).data.total).toBe(0);
    await staff('POST', `/bookings/${id}/execute`);
    expect((await list('status=da_fatturare')).data.total).toBe(1);
    expect((await list('status=tutte&from=2031-08-02')).data.total).toBe(0);
    expect((await list(`status=tutte&q=${c.lastName}`)).data.total).toBe(1);
    expect((await list('pageSize=101')).status).toBe(400);
    const k = (await staff('GET', '/bookings/kpis')).data;
    expect(Object.keys(k).sort()).toEqual([
      'invoicedMonthCents',
      'toCollectCents',
      'toConfirm',
      'toInvoice',
      'today',
    ]);
    expect(k.toInvoice).toBeGreaterThan(0);
  });
});

describe('invoices', () => {
  const issue = (memberId: string, bookingIds: string[], extra: object = {}) =>
    staff('POST', '/invoices', { memberId, bookingIds, ...extra });

  it('applies stamp duty above the threshold only (7747 none, 7748 yes)', async () => {
    const c = await mkMember();
    const lo = await mkDone(c.id, (await mkService(7747)).id);
    const hi = await mkDone(c.id, (await mkService(7748)).id);
    const a = await issue(c.id, [lo]);
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({
      subtotalCents: 7747,
      stampDutyCents: 0,
      totalCents: 7747,
      status: 'emessa',
    });
    const b = await issue(c.id, [hi]);
    expect(b.data).toMatchObject({ subtotalCents: 7748, stampDutyCents: 200, totalCents: 7948 });
    expect(b.data.lines).toHaveLength(1);
  });

  it('numbers per year, creates only the current counter row, keeps numbers after void', async () => {
    const c = await mkMember();
    const svc = await mkService(1000);
    const before = (await sql`select year, last_number from invoice_counters`).map((r) => ({
      ...r,
    }));
    const cur0 = before.find((r) => r.year === year)?.last_number ?? 0;
    const b1 = await mkDone(c.id, svc.id);
    const rid = `rid-${tag}-inv`;
    const i1 = await staff(
      'POST',
      '/invoices',
      { memberId: c.id, bookingIds: [b1] },
      { 'x-request-id': rid },
    );
    expect([i1.data.year, i1.data.number]).toEqual([year, cur0 + 1]);
    const rows = await sql`select year, last_number from invoice_counters`;
    expect(rows.find((r) => r.year === year)!.last_number).toBe(cur0 + 1);
    for (const o of before.filter((r) => r.year !== year))
      expect(rows.find((r) => r.year === o.year)!.last_number).toBe(o.last_number);
    expect(rows.length).toBe(
      before.some((r) => r.year === year) ? before.length : before.length + 1,
    );
    expect(
      ((await staff('GET', `/bookings?memberId=${c.id}&status=tutte`)).data.items as J[])[0]
        .invoiceNumber,
    ).toBe(`${cur0 + 1}/${year}`);

    // an invoiced booking cannot be invoiced twice
    const again = await issue(c.id, [b1]);
    expect([again.status, again.data.error.code]).toEqual([409, 'BOOKINGS_NOT_INVOICEABLE']);

    // void: reason required, bookings invoiceable again, number kept and not reused
    expect((await staff('POST', `/invoices/${i1.data.id}/void`, { reason: '  ' })).status).toBe(
      400,
    );
    const v = await staff(
      'POST',
      `/invoices/${i1.data.id}/void`,
      { reason: 'Errore' },
      { 'x-request-id': `${rid}-v` },
    );
    expect(v.data).toMatchObject({ status: 'annullata', voidReason: 'Errore', number: cur0 + 1 });
    expect(v.data.voidedOn).toBe(today);
    const vb = (await staff('GET', `/bookings?memberId=${c.id}&status=da_fatturare`)).data
      .items as J[];
    expect(vb.map((x) => x.id)).toEqual([b1]);
    expect(vb[0].invoiceId).toBeNull();
    const v2 = await staff('POST', `/invoices/${i1.data.id}/void`, { reason: 'Ancora' });
    expect([v2.status, v2.data.error.code]).toEqual([409, 'INVOICE_NOT_VOIDABLE']);
    expect(
      (await staff('POST', `/invoices/${crypto.randomUUID()}/void`, { reason: 'x' })).status,
    ).toBe(404);
    const i2 = await issue(c.id, [b1]);
    expect(i2.data.number).toBe(cur0 + 2);
    expect((await staff('GET', `/invoices/${i1.data.id}`)).data.number).toBe(cur0 + 1);

    const audit =
      await sql`select table_name, action from audit_log where request_id in (${rid}, ${rid + '-v'}) and actor_id = ${STAFF}`;
    const has = (t: string, a: string) => audit.some((x) => x.table_name === t && x.action === a);
    expect(
      has('invoices', 'insert') &&
        has('invoices', 'update') &&
        (has('invoice_counters', 'insert') || has('invoice_counters', 'update')),
    ).toBe(true);

    // void PDF
    const pdf = await staff('GET', `/invoices/${i1.data.id}/pdf`);
    expect(pdf.res.headers.get('content-type')).toBe('application/pdf');
    expect(
      Buffer.from(await pdf.res.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
  });

  it('issue edge cases, tax code saved on member, pay, list, kpis, csv', async () => {
    const c = await mkMember();
    const svc = await mkService(4000);
    const b = await mkDone(c.id, svc.id);
    const open = (
      await staff('POST', '/bookings', {
        memberId: c.id,
        serviceId: svc.id,
        day: today,
        slot: 'mattina',
      })
    ).data.id;
    expect((await issue(c.id, [open])).data.error.code).toBe('BOOKINGS_NOT_INVOICEABLE');
    expect((await issue(c.id, [])).status).toBe(400);
    expect((await issue(crypto.randomUUID(), [b])).data.error.code).toBe('MEMBER_NOT_FOUND');
    const other = await mkMember();
    expect((await issue(other.id, [b])).data.error.code).toBe('BOOKINGS_NOT_INVOICEABLE');
    const bad = await issue(c.id, [b], { customerTaxCode: 'RSSMRA85T10A562T' });
    expect([bad.status, bad.data.error.code]).toEqual([422, 'TAX_CODE_INVALID']);
    expect((await sql`select count(*)::int n from invoices where member_id = ${c.id}`)[0]!.n).toBe(
      0,
    );

    const invTax = fakeTax();
    const i = await issue(c.id, [b], {
      customerTaxCode: invTax,
      taxCodeConfirmed: true,
      customerAddress: 'Via Fattura 3',
      paymentMethod: 'bonifico',
    });
    expect(i.status).toBe(201);
    expect(i.data).toMatchObject({
      status: 'pagata',
      paymentMethod: 'bonifico',
      paidOn: today,
      customerTaxCode: invTax,
      customerAddress: 'Via Fattura 3',
    });
    // the tax code is kept on the member, the address is not
    const md = (await staff('GET', `/members/${c.id}`)).data;
    expect(md.taxCode).toBe(invTax);
    expect(md.address).toBeNull();
    expect(md.invoices).toHaveLength(1);
    expect(md.bookings.length).toBe(2);

    // pay
    const paid = await staff('POST', `/invoices/${i.data.id}/pay`, { method: 'pos' });
    expect([paid.status, paid.data.error.code]).toEqual([409, 'INVOICE_NOT_PAYABLE']);
    const b2 = await mkDone(c.id, svc.id);
    const i2 = await issue(c.id, [b2]);
    expect(i2.data.status).toBe('emessa');
    expect(
      (await staff('POST', `/invoices/${i2.data.id}/pay`, { method: 'pos', paidOn: today })).data,
    ).toMatchObject({ status: 'pagata', paymentMethod: 'pos', paidOn: today });
    const c4 = await mkMember(); // separate member: keeps the counts below untouched
    const b4 = await mkDone(c4.id, svc.id);
    const i4 = await issue(c4.id, [b4]);
    const nextYear = `${year + 1}-01-01`;
    const early = await staff('POST', `/invoices/${i4.data.id}/pay`, {
      method: 'pos',
      paidOn: '2000-01-01',
    });
    expect([early.status, early.data.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    const fut = await staff('POST', `/invoices/${i4.data.id}/pay`, {
      method: 'pos',
      paidOn: nextYear,
    });
    expect([fut.status, fut.data.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    expect(fut.res.headers.get('cache-control')).toBe('no-store');
    expect(
      (await staff('POST', `/invoices/${crypto.randomUUID()}/pay`, { method: 'pos' })).status,
    ).toBe(404);
    expect((await staff('POST', `/invoices/${i2.data.id}/pay`, { method: 'x' })).status).toBe(400);
    const b3 = await mkDone(c.id, svc.id);
    const i3 = await issue(c.id, [b3]);
    expect((await staff('POST', `/invoices/${i3.data.id}/void`, { reason: 'x' })).data.status).toBe(
      'annullata',
    );
    expect(
      (await staff('POST', `/invoices/${i3.data.id}/pay`, { method: 'pos' })).data.error.code,
    ).toBe('INVOICE_NOT_PAYABLE');

    // list / kpis / csv
    const l = (await staff('GET', `/invoices?year=${year}&q=${c.lastName}`)).data;
    expect(l.total).toBe(3);
    expect(l.items[0].number).toBeGreaterThan(l.items[2].number); // number desc
    expect(
      (await staff('GET', `/invoices?status=annullata&year=${year}&q=${c.lastName}`)).data.total,
    ).toBe(1);
    const k = (await staff('GET', `/invoices/kpis?year=${year}`)).data;
    expect(Object.keys(k).sort()).toEqual([
      'collectedCents',
      'count',
      'toCollectCents',
      'totalCents',
    ]);
    expect(k.collectedCents).toBeGreaterThanOrEqual(8000);
    const csv = await staff('GET', `/invoices/export.csv?year=${year}`);
    expect(csv.res.headers.get('content-disposition')).toContain(`fatture-${year}.csv`);
    const raw = Buffer.from(await csv.res.arrayBuffer());
    expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = raw.toString('utf8');
    expect(text.startsWith('﻿"Numero";"Data"')).toBe(true);
    expect(text).toContain('"40,00"');
    expect(text).toContain('"Annullata"');
    expect(text).toContain(`"Via Fattura 3"`);
    expect((await staff('GET', '/invoices/not-a-uuid')).status).toBe(400);
    expect((await staff('GET', `/invoices/${crypto.randomUUID()}`)).status).toBe(404);
  });
});
