import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  process.env.API_PROXY_SECRET = 'proxy-secret-for-test';
});
import { app } from '../../src/app.js';
import { sql } from '../db/helpers.js';

const SVC = 'fa000000-0000-4000-8000-0000000000aa';
const PHONE = '3339990001';
const IP = '203.0.113.7';
const day = new Date(Date.now() + 3 * 86400_000);
if (day.getUTCDay() === 0) day.setUTCDate(day.getUTCDate() + 1);
const DAY = day.toISOString().slice(0, 10);

const body = (o: object = {}) => ({
  serviceId: SVC,
  day: DAY,
  slot: 'mattina',
  firstName: 'Test',
  lastName: 'Pubblico',
  phone: '+39 333 999 0001',
  declaredMember: false,
  turnstileToken: 'tok',
  ...o,
});
const post = (b: object, h: Record<string, string> = {}) =>
  app.request('/public/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': IP, ...h },
    body: JSON.stringify(b),
  });
const turnstile = (success: boolean) =>
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ success })));

async function cleanup() {
  await sql`delete from transports where booking_id in (select id from bookings where service_id = ${SVC})`;
  await sql`delete from bookings where service_id = ${SVC}`;
  await sql`delete from clients where phone_normalized = ${PHONE}`;
  await sql`delete from rate_limit_hits`;
}

beforeEach(async () => {
  await cleanup();
  await sql`insert into services (id, name, member_price_cents, non_member_price_cents, requires_transport, sort_order)
            values (${SVC}, 'Test trasporto', 0, 0, true, 1000) on conflict (id) do nothing`;
  turnstile(true);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanup();
  await sql`delete from services where id = ${SVC}`;
  await sql.end();
});

describe('POST /public/bookings', () => {
  it('creates the booking and a richiesto transport; stores the national phone', async () => {
    const res = await post(body());
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(await sql`select status from transports where booking_id = ${id}`).toEqual([
      { status: 'richiesto' },
    ]);
    expect(
      (await sql`select count(*)::int n from clients where phone_normalized = ${PHONE}`)[0]!.n,
    ).toBe(1);
  });
  it('400 VALIDATION_ERROR without echoing values', async () => {
    const res = await post(body({ phone: '123' }));
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error: { code: string } };
    expect(j.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(j)).not.toContain('Pubblico');
  });
  it('400 TURNSTILE_FAILED on failure and on empty token', async () => {
    turnstile(false);
    expect(((await (await post(body())).json()) as { error: { code: string } }).error.code).toBe(
      'TURNSTILE_FAILED',
    );
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const res = await post(body({ turnstileToken: '' }));
    expect(res.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
  it('422 INVALID_DAY and SERVICE_NOT_BOOKABLE', async () => {
    let res = await post(body({ day: '2000-01-03' }));
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('INVALID_DAY');
    res = await post(body({ serviceId: crypto.randomUUID() }));
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'SERVICE_NOT_BOOKABLE',
    );
  });
  it('429 RATE_LIMITED on the 6th attempt; another IP unaffected; spoofed x-client-ip ignored', async () => {
    turnstile(false); // failed attempts count too (ADR-039)
    for (let i = 0; i < 5; i++) expect((await post(body())).status).toBe(400);
    turnstile(true);
    const spoof = { 'x-client-ip': '198.51.100.9' }; // no secret: still counted as IP
    const res = await post(body(), spoof);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
    expect((await post(body(), { 'x-real-ip': '203.0.113.8' })).status).toBe(201);
  });
});

describe('GET /public/*', () => {
  it('lists active services in camelCase and returns site settings', async () => {
    const s = (await (await app.request('/public/services')).json()) as {
      items: Record<string, unknown>[];
    };
    expect(s.items.find((x) => x.id === SVC)).toMatchObject({
      name: 'Test trasporto',
      requiresTransport: true,
      bookable: true,
    });
    const t = await (await app.request('/public/site-settings')).json();
    expect(Object.keys(t as object).sort()).toEqual([
      'address',
      'email',
      'homeIntro',
      'membershipInfo',
      'openingHours',
      'phone',
      'slogan',
    ]);
  });
});
