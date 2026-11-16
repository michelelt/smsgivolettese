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
    await sql`select address, slogan, home_intro, vat_number, conventions, footer_links, pages from site_settings`
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
        conventions = ${sql.json(site0.conventions as never)}, footer_links = ${sql.json(site0.footer_links as never)},
        pages = ${sql.json(site0.pages as never)}`;
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
const mkService = async (extra: object = {}) =>
  (await staff('POST', '/services', { name: `ZZT s${n++} ${tag}`, ...extra })).data;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
// A completed (svolto) transport; closed in SQL: the staff /complete path needs a driver (phase5 covers it).
let doneN = 0;
const mkDone = async (memberId: string) => {
  const t = (
    await staff('POST', '/transports', { memberId, travelDate: today, departureTime: '08:00' })
  ).data;
  // svolto needs driver and addresses; a distinct past day per call keeps driver commitments apart
  const shift = `${++doneN} days`;
  await sql`update transports set status = 'svolto', odometer_start = 100, odometer_end = 112,
    driver_volunteer_id = (select id from volunteers order by id limit 1),
    from_address = 'Via Roma 1', to_address = 'Ospedale',
    travel_date = travel_date - ${shift}::interval, departure_at = departure_at - ${shift}::interval,
    completed_at = now() where id = ${t.id}`;
  return t.id as string;
};
let taxN = 0;
const fakeTax = () =>
  `ZZ${tag.toUpperCase().padEnd(6, '0').slice(0, 6)}${String(taxN++).padStart(8, '0')}`.slice(
    0,
    16,
  );

describe('permissions', () => {
  const routes: [string, string][] = [
    ['GET', '/members'],
    ['GET', '/members/export.csv'],
    ['POST', '/members'],
    ['GET', '/transports/00000000-0000-4000-8000-000000000000/proforma.pdf'],
    ['PUT', '/transports/00000000-0000-4000-8000-000000000000/collected'],
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
    const s = await mkService();
    expect(s).toMatchObject({ active: true });
    expect(s).not.toHaveProperty('priceCents');
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
    expect((await staff('POST', '/services', { name: '' })).status).toBe(400);
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
      pg('chiSiamo', { ...chi, sections: [{ ...sec, span: 6 }] }),
      pg('chiSiamo', { ...chi, sections: [{ ...sec, image: { path: '../x.jpg', alt: '' } }] }),
      pg('privacy', { ...chi, sections: [{ heading: 'H', body: 'B', span: 2 }] }),
      pg('privacy', { ...chi, sections: [{ heading: 'H', body: 'x'.repeat(5001) }] }),
    ];
    for (const b of bad) expect((await staff('PUT', '/site-settings', b)).status).toBe(400);
    const img = {
      path: '2026/0b3c3f0e-1d2a-4c1e-9f00-123456789abc.webp',
      alt: 'Sede',
      width: 800,
      height: 600,
    };
    const withImg = pg('chiSiamo', { ...chi, sections: [{ ...sec, span: 3, image: img }] });
    expect((await staff('PUT', '/site-settings', withImg)).status).toBe(200);
    const saved = (await (await app.request('/public/site-settings')).json()) as J;
    expect((saved.pages as J).chiSiamo).toMatchObject({ sections: [{ span: 3, image: img }] });
    const o = (await staff('GET', '/org-info')).data;
    expect(o).not.toHaveProperty('kmRateCents');
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
    expect(r.data).toMatchObject({ transports: [] });
    expect(r.data).not.toHaveProperty('invoices');

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
    const k = (await staff('GET', '/members/kpis')).data;
    expect(k.active).toBeGreaterThan(0);
    expect(k.total).toBeGreaterThanOrEqual(k.active + k.ceased);
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

  it('member detail lists transports; q matches name, card, tax code, phone', async () => {
    const tc = fakeTax();
    const m = await mkMember({ taxCode: tc, taxCodeConfirmed: true, phone: `339${tag}` });
    const t = await mkDone(m.id);
    const d = (await staff('GET', `/members/${m.id}`)).data;
    expect(d).not.toHaveProperty('bookings');
    expect(d).not.toHaveProperty('invoices');
    expect(d.transports.map((x: J) => x.id)).toEqual([t]);
    expect(d.transports[0]).toMatchObject({ odometerStart: 100, km: 12 });
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

describe('transports create', () => {
  it('needs departure or appointment time, 422 for a cessato member, validates fields', async () => {
    const m = await mkMember();
    const day = '2031-05-06';
    const ok = await staff('POST', '/transports', {
      memberId: m.id,
      travelDate: day,
      appointmentTime: '10:00',
      contactPhone: '3331112222',
      mobilityAids: true,
      companions: 2,
    });
    expect(ok.status).toBe(201);
    expect(ok.data).toMatchObject({
      contactPhone: '3331112222',
      mobilityAids: true,
      companions: 2,
      status: 'richiesto',
      km: null,
      bandLabel: null,
      collectedCents: null,
    });
    expect(ok.data).not.toHaveProperty('companion');
    const bad = (b: object) =>
      staff('POST', '/transports', { memberId: m.id, travelDate: day, ...b });
    expect((await bad({})).status).toBe(400); // no departure and no appointment
    expect((await bad({ departureTime: '08:00', companions: 9 })).status).toBe(400);
    expect((await bad({ departureTime: '08:00', contactPhone: 'x'.repeat(41) })).status).toBe(400);
    expect((await bad({ departureTime: '08:00', reason: 'x' })).status).toBe(400); // removed field
    expect((await bad({ departureTime: '08:00', returnTime: '07:00' })).status).toBe(400);
    // patching everything away from the time check is rejected by the DB check
    expect(
      (await staff('PATCH', `/transports/${ok.data.id}`, { appointmentTime: null })).status,
    ).toBe(400);
    await staff('POST', `/members/${m.id}/end`, { endReason: 'dimissioni' });
    const ended = await bad({ departureTime: '08:00' });
    expect([ended.status, ended.data.error.code]).toEqual([422, 'MEMBER_NOT_ACTIVE']);
  });
});

describe('price bands, collected amount, pro forma (ADR-075)', () => {
  let bands0: unknown;
  beforeAll(async () => {
    bands0 = (await sql`select price_bands from org_settings`)[0]!.price_bands;
    await sql`update org_settings set price_bands = ${sql.json([
      { upToKm: 10, priceCents: 500, color: '#00AA00', label: 'Verde' },
      { upToKm: 20, priceCents: 1000, color: '#FFAA00', label: 'Giallo' },
      { upToKm: null, priceCents: 2000, color: '#AA0000', label: 'Rosso' },
    ])}`;
  });
  afterAll(async () => {
    await sql`update org_settings set price_bands = ${sql.json(bands0 as never)}`;
  });

  it('snapshots the band from km at completion; boundary km stays in the lower band', async () => {
    const m = await mkMember();
    const t = await mkDone(m.id); // 12 km
    expect((await staff('GET', `/transports/${t}`)).data).toMatchObject({
      km: 12,
      bandLabel: 'Giallo',
      bandColor: '#FFAA00',
      bandPriceCents: 1000,
      collectedCents: null,
    });
    await sql`update transports set odometer_end = 120 where id = ${t}`; // 20 km
    expect((await staff('GET', `/transports/${t}`)).data.bandLabel).toBe('Giallo');
    await sql`update transports set odometer_end = 121 where id = ${t}`;
    expect((await staff('GET', `/transports/${t}`)).data.bandLabel).toBe('Rosso');
    // a later price change does not rewrite the snapshot
    await sql`update org_settings set price_bands = jsonb_set(price_bands, '{2,priceCents}', '9999')`;
    expect((await staff('GET', `/transports/${t}`)).data.bandPriceCents).toBe(2000);
  });

  it('staff records the collected amount on a done transport only', async () => {
    const m = await mkMember();
    const t = await mkDone(m.id);
    const r = await staff('PUT', `/transports/${t}/collected`, { collectedCents: 800 });
    expect([r.status, r.data.collectedCents]).toEqual([200, 800]);
    expect(
      (await staff('PUT', `/transports/${t}/collected`, { collectedCents: null })).data,
    ).toMatchObject({ collectedCents: null });
    expect((await staff('PUT', `/transports/${t}/collected`, { collectedCents: -1 })).status).toBe(
      400,
    );
    const open = (
      await staff('POST', '/transports', {
        memberId: m.id,
        travelDate: today,
        departureTime: '09:00',
      })
    ).data;
    const no = await staff('PUT', `/transports/${open.id}/collected`, { collectedCents: 100 });
    expect([no.status, no.data.error.code]).toEqual([409, 'TRANSPORT_INVALID_TRANSITION']);
    expect(
      (await staff('PUT', `/transports/${crypto.randomUUID()}/collected`, { collectedCents: 1 }))
        .status,
    ).toBe(404);
  });

  it('pro forma PDF for done transports only', async () => {
    const m = await mkMember();
    const t = await mkDone(m.id);
    const pdf = await staff('GET', `/transports/${t}/proforma.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.res.headers.get('content-type')).toContain('application/pdf');
    const open = (
      await staff('POST', '/transports', {
        memberId: m.id,
        travelDate: today,
        departureTime: '10:00',
      })
    ).data;
    expect((await staff('GET', `/transports/${open.id}/proforma.pdf`)).status).toBe(409);
  });

  it('rejects unordered bands or a closed last band', async () => {
    const o = (await staff('GET', '/org-settings')).data;
    const b = (priceBands: unknown) => ({ ...o, priceBands });
    const band = (upToKm: number | null) => ({
      upToKm,
      priceCents: 1,
      color: '#000000',
      label: 'X',
    });
    for (const bad of [
      [band(20)],
      [band(20), band(10), band(null)],
      [],
      [{ ...band(null), color: 'red' }],
    ])
      expect((await staff('PUT', '/org-settings', b(bad))).status).toBe(400);
  });
});
