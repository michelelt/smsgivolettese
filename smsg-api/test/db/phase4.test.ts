import { afterAll, describe, expect, it } from 'vitest';
import { actAs, attempt, fixtures, rolledBack, sql } from './helpers';

afterAll(() => sql.end());
type Tx = Parameters<Parameters<typeof rolledBack>[0]>[0];
const err = async (tx: Tx, q: string) => {
  const r = await attempt(tx, q);
  return r.ok ? 'OK' : `${r.code}:${r.message}`;
};
const TRANSPORT = 'fc000000-0000-4000-8000-000000000001';
const link = (b: string) =>
  `update site_settings set footer_links = '${JSON.stringify([b ? JSON.parse(b) : {}])}'`;

describe('transport cancel frees the commitment (ADR-070: no bookings)', () => {
  it('cancelling an assigned transport deletes its commitment', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      const q = () =>
        tx.unsafe(`select 1 from volunteer_commitments where transport_id = '${TRANSPORT}'`);
      expect(await q()).toHaveLength(1);
      await tx.unsafe(`update transports set status = 'annullato' where id = '${TRANSPORT}'`);
      expect(await q()).toHaveLength(0);
    });
  });
});

describe('site_settings_links_valid (ADR-051)', () => {
  const bad = [
    ['http url', { group: 'utili', label: 'A', url: 'http://x.test' }],
    ['empty label', { group: 'utili', label: ' ', url: 'https://x.test' }],
    ['unknown group', { group: 'altro', label: 'A', url: 'https://x.test' }],
  ] as const;
  for (const [name, item] of bad)
    it(`rejects ${name}`, async () => {
      await rolledBack(async (tx) => {
        await fixtures(tx);
        await actAs(tx, 'staff');
        expect(await err(tx, link(JSON.stringify(item)))).toMatch(/^23514/);
      });
    });
  it('rejects a convention with http url, accepts a valid one as staff', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'staff');
      expect(
        await err(tx, `update site_settings set conventions = '[{"title":"A","url":"http://x"}]'`),
      ).toMatch(/^23514/);
      expect(
        await err(tx, link(JSON.stringify({ group: 'utili', label: 'A', url: 'https://x.test' }))),
      ).toBe('OK');
      expect(await err(tx, `update site_settings set conventions = '[{"title":"A"}]'`)).toBe('OK');
    });
  });
  it('seed data passes the check', async () => {
    const [r] =
      await sql`select app.site_links_valid(conventions, footer_links) ok, vat_number from site_settings`;
    expect(r!.ok).toBe(true);
    expect(r!.vat_number).toMatch(/^\d{11}$/);
  });
});

describe('members card number', () => {
  it('cannot change, other columns can', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      const id = 'f7000000-0000-4000-8000-000000000001';
      expect(await err(tx, `update members set card_number = 9002 where id = '${id}'`)).toMatch(
        /CARD_NUMBER_IMMUTABLE/,
      );
      expect(await err(tx, `update members set first_name = 'Z' where id = '${id}'`)).toBe('OK');
    });
  });
});

describe('staff_org_info', () => {
  for (const [role, code] of [
    ['anon', '42501'],
    ['volontario', '42501'],
  ] as const)
    it(`denied to ${role}`, async () => {
      await rolledBack(async (tx) => {
        await fixtures(tx);
        await actAs(tx, role);
        expect(await err(tx, 'select * from staff_org_info()')).toMatch(new RegExp(`^${code}`));
      });
    });
  it('allowed to staff', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'staff');
      const rows = await tx.unsafe('select * from staff_org_info()');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.next_card_number).toBeGreaterThan(0);
    });
  });
});

describe('demo transports seed', () => {
  it('has one richiesto and one svolto (odometers, no invoice) for the example member; km rate 35', async () => {
    const rows =
      await sql`select t.status, t.km, t.invoice_id from transports t join members c on c.id = t.member_id
      where c.last_name = 'Rossi (esempio)' order by t.status`;
    expect(rows).toEqual([
      { status: 'richiesto', km: null, invoice_id: null },
      { status: 'svolto', km: 42, invoice_id: null },
    ]);
    expect((await sql`select km_rate_cents from org_settings`)[0]!.km_rate_cents).toBe(35);
  });
});

describe('phase 4 review fixes', () => {
  it('audits members, services and site_settings updates', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(
        `update members set notes = 'x' where id = 'f7000000-0000-4000-8000-000000000001'`,
      );
      await tx.unsafe(
        `update services set name = 'S2' where id = 'fa000000-0000-4000-8000-000000000001'`,
      );
      await tx.unsafe(`update site_settings set slogan = 'x'`);
      const rows = await tx.unsafe(
        `select distinct table_name from audit_log where action = 'update' and table_name in ('members','services','site_settings')`,
      );
      expect(rows.map((r) => r.table_name).sort()).toEqual([
        'members',
        'services',
        'site_settings',
      ]);
    });
  });

  it('rejects invoice paid_on before issued_on or in the future, and future fee paid_on', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      const inv = `update invoices set status = 'pagata', payment_method = 'contanti', paid_on =`;
      const id = `where id = 'fd000000-0000-4000-8000-000000000001'`;
      expect(await err(tx, `${inv} current_date - 1 ${id}`)).toMatch(/^23514/);
      expect(await err(tx, `${inv} current_date + 2 ${id}`)).toMatch(/^23514:PAID_ON_IN_FUTURE/);
      expect(await err(tx, `${inv} current_date ${id}`)).toBe('OK');
      expect(
        await err(
          tx,
          `update membership_fees set paid_on = current_date + 2 where id = 'f8000000-0000-4000-8000-000000000001'`,
        ),
      ).toMatch(/^23514:PAID_ON_IN_FUTURE/);
    });
  });
});

describe('site_settings.pages (ADR-061)', () => {
  const set = (v: string) => `update site_settings set pages = '${v.replaceAll("'", "''")}'::jsonb`;
  it('rejects a missing key or a non-object with 23514', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'staff');
      const pages = (await tx.unsafe(`select pages from site_settings`))[0]!.pages;
      const missing = Object.fromEntries(Object.entries(pages).filter(([k]) => k !== 'privacy'));
      expect(await err(tx, set(JSON.stringify(missing)))).toMatch(/^23514/);
      expect(await err(tx, set('[]'))).toMatch(/^23514/);
      expect(await err(tx, set('"x"'))).toMatch(/^23514/);
      expect(await err(tx, set(JSON.stringify(pages)))).toBe('OK');
    });
  });
  it('is readable by anon and filled with the seeded copy', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'anon');
      const [r] = await tx.unsafe(`select pages from site_settings`);
      expect(Object.keys(r!.pages).sort()).toEqual([
        'chiSiamo',
        'convenzioni',
        'doveSiamo',
        'home',
        'privacy',
        'servizi',
      ]);
    });
  });
  it('denies volontario updates and audits staff updates', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'volontario');
      const rows = await tx
        .unsafe(
          `update site_settings set pages = jsonb_set(pages, '{home,quote}', '"x"') returning 1`,
        )
        .catch(() => []);
      expect(rows).toHaveLength(0);
    });
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'staff');
      await tx.unsafe(`update site_settings set pages = jsonb_set(pages, '{home,quote}', '"x"')`);
      await tx.unsafe('reset role'); // audit_log is not readable by staff
      const a = await tx.unsafe(
        `select 1 from audit_log where table_name = 'site_settings' and action = 'update'`,
      );
      expect(a.length).toBeGreaterThan(0);
    });
  });
});
