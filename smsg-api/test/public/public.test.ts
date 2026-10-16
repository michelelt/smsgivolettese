import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.API_PROXY_SECRET = 'proxy-secret-for-test';
});
import { app } from '../../src/app.js';
import { sql } from '../db/helpers.js';

const SVC = 'fa000000-0000-4000-8000-0000000000aa';

beforeEach(async () => {
  await sql`insert into services (id, name, price_cents, sort_order)
            values (${SVC}, 'Test servizio', 1500, 1000) on conflict (id) do nothing`;
});
afterAll(async () => {
  await sql`delete from services where id = ${SVC}`;
  await sql.end();
});

describe('GET /public/*', () => {
  it('lists active services with explicit fields and no prices', async () => {
    const s = (await (await app.request('/public/services')).json()) as {
      items: Record<string, unknown>[];
    };
    const svc = s.items.find((x) => x.id === SVC)!;
    expect(Object.keys(svc).sort()).toEqual(['description', 'id', 'name', 'scheduleNote']);
    expect(JSON.stringify(s)).not.toMatch(/price|Price|bookable|requiresTransport/);
  });
  it('returns showcase site settings without phone/email', async () => {
    const t = (await (await app.request('/public/site-settings')).json()) as Record<
      string,
      unknown
    >;
    expect(Object.keys(t).sort()).toEqual([
      'address',
      'conventions',
      'footerLinks',
      'homeIntro',
      'slogan',
      'vatNumber',
    ]);
    expect(Array.isArray(t.conventions) && Array.isArray(t.footerLinks)).toBe(true);
  });
  it('fails closed with 500 on a non-https footer url in DB', async () => {
    const old = (await sql`select footer_links from site_settings`)[0]!.footer_links;
    // the DB check now blocks this state; drop it to simulate legacy data
    await sql`alter table site_settings drop constraint site_settings_links_valid`;
    await sql`update site_settings set footer_links = ${sql.json([{ group: 'utili', label: 'x', url: 'http://evil.example' }])}`;
    try {
      const r = await app.request('/public/site-settings');
      expect(r.status).toBe(500);
      expect(await r.text()).not.toContain('evil.example');
    } finally {
      await sql`update site_settings set footer_links = ${sql.json(old)}`;
      await sql`alter table site_settings add constraint site_settings_links_valid check (app.site_links_valid(conventions, footer_links))`;
    }
  });
  it('POST /public/bookings no longer exists', async () => {
    expect((await app.request('/public/bookings', { method: 'POST' })).status).toBe(404);
  });
});
