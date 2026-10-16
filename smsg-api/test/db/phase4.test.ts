import { afterAll, describe, expect, it } from 'vitest';
import { actAs, attempt, fixtures, rolledBack, sql } from './helpers';

afterAll(() => sql.end());
type Tx = Parameters<Parameters<typeof rolledBack>[0]>[0];
const err = async (tx: Tx, q: string) => {
  const r = await attempt(tx, q);
  return r.ok ? 'OK' : `${r.code}:${r.message}`;
};
const BOOKING = 'fb000000-0000-4000-8000-000000000001';
const TRANSPORT = 'fc000000-0000-4000-8000-000000000001';
const link = (b: string) =>
  `update site_settings set footer_links = '${JSON.stringify([b ? JSON.parse(b) : {}])}'`;

describe('booking -> transport sync (ADR-046)', () => {
  it('cancel frees the assigned transport and its commitment; restore reopens it without driver', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx
        .unsafe(`update bookings set status = 'attesa' where id = '${BOOKING}'`)
        .catch(() => {});
      await tx.unsafe(
        `update transports set booking_id = '${BOOKING}', vehicle_id = 'f1000000-0000-4000-8000-000000000001' where id = '${TRANSPORT}'`,
      );
      const commits = () =>
        tx.unsafe(`select 1 from volunteer_commitments where transport_id = '${TRANSPORT}'`);
      expect(await commits()).toHaveLength(1);
      await tx.unsafe(
        `update bookings set status = 'annullata', cancelled_by = 'staff' where id = '${BOOKING}'`,
      );
      const [t] = await tx.unsafe(`select status from transports where id = '${TRANSPORT}'`);
      expect(t!.status).toBe('annullato');
      expect(await commits()).toHaveLength(0);
      await tx.unsafe(`update bookings set status = 'attesa' where id = '${BOOKING}'`);
      const [r] = await tx.unsafe(
        `select status, driver_volunteer_id, vehicle_id from transports where id = '${TRANSPORT}'`,
      );
      expect(r).toEqual({ status: 'richiesto', driver_volunteer_id: null, vehicle_id: null });
    });
  });
  it('cancel leaves a completed transport alone', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(
        `update bookings set status = 'attesa', invoice_id = null where id = '${BOOKING}'`,
      );
      await tx.unsafe(
        `update transports set booking_id = '${BOOKING}', status = 'svolto', km = 5 where id = '${TRANSPORT}'`,
      );
      await tx.unsafe(
        `update bookings set status = 'annullata', cancelled_by = 'staff' where id = '${BOOKING}'`,
      );
      const [t] = await tx.unsafe(`select status from transports where id = '${TRANSPORT}'`);
      expect(t!.status).toBe('svolto');
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

describe('demo bookings seed', () => {
  it('has one attesa and two eseguita for the example client', async () => {
    const rows =
      await sql`select b.status, count(*)::int n from bookings b join clients c on c.id = b.client_id
      where c.last_name = 'Rossi (esempio)' group by 1`;
    expect(Object.fromEntries(rows.map((r) => [r.status, r.n]))).toEqual({
      attesa: 1,
      eseguita: 2,
    });
  });
});

describe('phase 4 review fixes', () => {
  it('audits clients, services and site_settings updates', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(
        `update clients set notes = 'x' where id = 'f9000000-0000-4000-8000-000000000001'`,
      );
      await tx.unsafe(
        `update services set name = 'S2' where id = 'fa000000-0000-4000-8000-000000000001'`,
      );
      await tx.unsafe(`update site_settings set slogan = 'x'`);
      const rows = await tx.unsafe(
        `select distinct table_name from audit_log where action = 'update' and table_name in ('clients','services','site_settings')`,
      );
      expect(rows.map((r) => r.table_name).sort()).toEqual([
        'clients',
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
