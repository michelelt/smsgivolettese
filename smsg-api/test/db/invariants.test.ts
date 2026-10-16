import { afterAll, describe, expect, it } from 'vitest';
import { ID, actAs, attempt, fixtures, rolledBack, sql, sqlCode } from './helpers';

type Tx = Parameters<Parameters<typeof rolledBack>[0]>[0];
afterAll(() => sql.end());

const reset = (tx: Tx) => tx.unsafe('reset role');
const world = async (tx: Tx) => fixtures(tx);
const err = async (tx: Tx, q: string) => {
  const r = await attempt(tx, q);
  return r.ok ? 'OK' : `${r.code}:${r.message}`;
};
const asStaff = async (tx: Tx) => {
  await world(tx);
  await actAs(tx, 'staff');
};
const SEED_STAFF = 'a0000000-0000-4000-8000-000000000002'; // seed.sql staff user (FK targets must be committed)
const BOOKING = 'fb000000-0000-4000-8000-000000000001';
const CLIENT = 'f9000000-0000-4000-8000-000000000001';
const issue = (ids = `'${BOOKING}'`, pay = 'null') =>
  `select * from issue_invoice('${CLIENT}', array[${ids}]::uuid[], null, null, ${pay})`;

describe('overlapping commitments (23P01)', () => {
  it('rejects a second overlapping shift assignment', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await tx.unsafe(`insert into shifts (id, shift_type_id, starts_at, ends_at, required_slots)
        select 'f5000000-0000-4000-8000-0000000000aa', shift_type_id, starts_at + interval '1 hour', ends_at + interval '1 hour', 1
        from shifts where id = 'f5000000-0000-4000-8000-000000000001'`);
      const q = `insert into shift_assignments (shift_id, volunteer_id) values ('f5000000-0000-4000-8000-0000000000aa', '${ID.vol}')`;
      expect(await err(tx, q)).toMatch(/^23P01/);
      // declined assignment frees the slot
      await tx.unsafe(
        `update shift_assignments set status = 'rifiutato' where id = 'f6000000-0000-4000-8000-000000000001'`,
      );
      expect(await err(tx, q)).toBe('OK');
    });
  });
  it('rejects moving a shift onto another commitment', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      const q = `update shifts set starts_at = (select starts_at from shifts where id = 'f5000000-0000-4000-8000-000000000001'),
        ends_at = (select ends_at from shifts where id = 'f5000000-0000-4000-8000-000000000001') where id = 'f5000000-0000-4000-8000-000000000002'`;
      expect(await err(tx, q)).toMatch(/^23P01/);
    });
  });
  it('rejects a shift overlapping an assigned transport, allows after cancellation', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await tx.unsafe(`insert into shifts (id, shift_type_id, starts_at, ends_at, required_slots) values
        ('f5000000-0000-4000-8000-0000000000bb', 'f4000000-0000-4000-8000-000000000001', now() + interval '10 days 30 minutes', now() + interval '10 days 90 minutes', 1)`);
      const q = `insert into shift_assignments (shift_id, volunteer_id) values ('f5000000-0000-4000-8000-0000000000bb', '${ID.vol}')`;
      expect(await err(tx, q)).toMatch(/^23P01/);
      await tx.unsafe(
        `update transports set status = 'annullato' where id = 'fc000000-0000-4000-8000-000000000001'`,
      );
      expect(await err(tx, q)).toBe('OK');
    });
  });
  it('rejects a transport assigned during a shift', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      const q = `update transports set status = 'assegnato', driver_volunteer_id = '${ID.vol}', from_address = 'a', to_address = 'b',
        departure_at = (select starts_at from shifts where id = 'f5000000-0000-4000-8000-000000000001') + interval '10 minutes'
        where id = 'fc000000-0000-4000-8000-000000000002'`;
      expect(await err(tx, q)).toMatch(/^23P01/);
    });
  });
});

describe('driver eligibility', () => {
  const assign = (
    driver: string,
    extra = '',
  ) => `update transports set status = 'assegnato', driver_volunteer_id = '${driver}', from_address = 'a',
    to_address = 'b', departure_at = now() + interval '20 days' ${extra} where id = 'fc000000-0000-4000-8000-000000000002'`;
  it('rejects a volunteer who cannot drive, accepts an eligible one', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      expect(await err(tx, assign(ID.vol2))).toMatch(/DRIVER_NOT_ELIGIBLE/);
      expect(await err(tx, assign(ID.vol))).toBe('OK');
    });
  });
  it('rejects expired licence and inactive volunteer', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await tx.unsafe(
        `update volunteers set license_expires_on = current_date + 5 where id = '${ID.vol}'`,
      );
      await tx.unsafe(
        `update transports set status = 'annullato' where id = 'fc000000-0000-4000-8000-000000000001'`,
      );
      expect(await err(tx, assign(ID.vol, ', travel_date = current_date + 6'))).toMatch(
        /DRIVER_NOT_ELIGIBLE/,
      );
      await tx.unsafe(`update volunteers set active = false where id = '${ID.vol}'`);
      expect(await err(tx, assign(ID.vol))).toMatch(/DRIVER_NOT_ELIGIBLE/);
    });
  });
  it('rejects vehicles that do not fit the transport', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      expect(
        await err(
          tx,
          assign(
            ID.vol,
            ", wheelchair = true, vehicle_id = 'f1000000-0000-4000-8000-000000000001'",
          ),
        ),
      ).toMatch(/VEHICLE_NOT_SUITABLE/);
      await tx.unsafe(
        `update vehicles set wheelchair_accessible = true where id = 'f1000000-0000-4000-8000-000000000001'`,
      );
      expect(
        await err(
          tx,
          assign(
            ID.vol,
            ", wheelchair = true, vehicle_id = 'f1000000-0000-4000-8000-000000000001'",
          ),
        ),
      ).toBe('OK');
      await tx.unsafe(
        `update transports set status = 'annullato' where id = 'fc000000-0000-4000-8000-000000000002'`,
      );
      await tx.unsafe(
        `update vehicles set active = false where id = 'f1000000-0000-4000-8000-000000000002'`,
      );
    });
  });
  it('blocks invalidating a driver with future transports', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      expect(
        await err(tx, `update volunteers set can_drive = false where id = '${ID.vol}'`),
      ).toMatch(/DRIVER_HAS_FUTURE_TRANSPORTS/);
      expect(await err(tx, `update volunteers set active = false where id = '${ID.vol}'`)).toMatch(
        /DRIVER_HAS_FUTURE_TRANSPORTS/,
      );
    });
  });
  it('enforces transport status checks', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      expect(
        await err(
          tx,
          `update transports set status = 'assegnato' where id = 'fc000000-0000-4000-8000-000000000002'`,
        ),
      ).toMatch(/^23514/);
      expect(
        await err(
          tx,
          `update transports set status = 'svolto' where id = 'fc000000-0000-4000-8000-000000000001'`,
        ),
      ).toMatch(/^23514/);
    });
  });
});

describe('uniqueness', () => {
  it('card number, tax code, fee per member-year, invoice number', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      const m = (card: number, tax: string) =>
        `insert into members (card_number, first_name, last_name, joined_on, tax_code) values (${card}, 'a', 'b', current_date, ${tax})`;
      expect(await err(tx, m(9001, 'null'))).toMatch(/^23505/);
      await tx.unsafe(m(9002, "'AAAAAAAAAAAAAAAA'"));
      expect(await err(tx, m(9003, "'AAAAAAAAAAAAAAAA'"))).toMatch(/^23505/);
      expect(
        await err(
          tx,
          `insert into membership_fees (member_id, year, amount_cents, paid_on, method) values ('f7000000-0000-4000-8000-000000000001', 2025, 1, current_date, 'pos')`,
        ),
      ).toMatch(/^23505/);
      expect(
        await err(
          tx,
          `insert into invoices (year, number, issued_on, client_id, customer_name, issuer_name, vat_exemption_text, subtotal_cents, stamp_duty_cents, total_cents, status)
        values (2020, 1, current_date, '${CLIENT}', 'c', 'i', 'v', 1, 0, 1, 'emessa')`,
        ),
      ).toMatch(/^23505/);
      expect(
        await err(tx, `insert into vehicles (plate, model, seats) values ('TT001TT', 'm', 4)`),
      ).toMatch(/^23505/);
    });
  });
});

describe('invoice numbering', () => {
  const lastNumber = async (tx: Tx) => {
    const [r] =
      await tx`select coalesce((select last_number from invoice_counters where year = extract(year from now() at time zone 'Europe/Rome')), 0) as n`;
    return r!.n as number;
  };
  it('issues sequential numbers with snapshot, lines and stamp duty', async () => {
    await rolledBack(async (tx) => {
      await asStaff(tx);
      await reset(tx);
      const before = await lastNumber(tx);
      await actAs(tx, 'staff');
      const [inv] = await tx.unsafe(issue());
      expect(inv).toMatchObject({
        number: before + 1,
        subtotal_cents: 300,
        stamp_duty_cents: 0,
        total_cents: 300,
        status: 'emessa',
      });
      const lines = await tx`select description from invoice_lines where invoice_id = ${inv!.id}`;
      expect(lines[0]!.description).toMatch(/^S-active del \d\d\/\d\d\/\d{4}$/);
      expect((await tx`select invoice_id from bookings where id = ${BOOKING}`)[0]!.invoice_id).toBe(
        inv!.id,
      );
    });
  });
  it('applies stamp duty strictly above the threshold and marks paid', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await tx.unsafe(`update bookings set price_applied_cents = 7747 where id = '${BOOKING}'`);
      await actAs(tx, 'staff');
      const [a] = await tx.unsafe(issue());
      expect(a).toMatchObject({ stamp_duty_cents: 0, total_cents: 7747 });
      await tx.unsafe('reset role');
      await tx.unsafe(
        `update bookings set price_applied_cents = 7748, invoice_id = null where id = '${BOOKING}'`,
      );
      await actAs(tx, 'staff');
      const [b] = await tx.unsafe(issue(`'${BOOKING}'`, "'pos'"));
      expect(b).toMatchObject({ stamp_duty_cents: 200, total_cents: 7948, status: 'pagata' });
    });
  });
  it('rejects non-invoiceable bookings and lower roles', async () => {
    await rolledBack(async (tx) => {
      await asStaff(tx);
      expect(await err(tx, issue(`'${BOOKING}','${BOOKING.replace(/1$/, '9')}'`))).toMatch(
        /BOOKINGS_NOT_INVOICEABLE/,
      );
      expect(await err(tx, issue(''))).toMatch(/BOOKINGS_NOT_INVOICEABLE/);
      await tx.unsafe(issue());
      expect(await err(tx, issue())).toMatch(/BOOKINGS_NOT_INVOICEABLE/);
    });
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'volontario');
      expect(await err(tx, issue())).toMatch(/^42501/);
    });
  });
  it('void keeps the number, frees the booking and the next number moves on; invoices are immutable', async () => {
    await rolledBack(async (tx) => {
      await asStaff(tx);
      const [inv] = await tx.unsafe(issue());
      const [v] = await tx`select * from void_invoice(${inv!.id}, 'errore')`;
      expect(v).toMatchObject({ status: 'annullata', number: inv!.number, year: inv!.year });
      expect(
        (await tx`select invoice_id from bookings where id = ${BOOKING}`)[0]!.invoice_id,
      ).toBeNull();
      expect(await err(tx, `select void_invoice('${inv!.id}', 'again')`)).toMatch(
        /INVOICE_NOT_VOIDABLE/,
      );
      const [next] = await tx.unsafe(issue());
      expect(next!.number).toBe(inv!.number + 1);
      expect(
        await err(tx, `update invoices set customer_name = 'x' where id = '${inv!.id}'`),
      ).toMatch(/INVOICE_IMMUTABLE/);
      expect(
        await err(
          tx,
          `update invoices set total_cents = 1, subtotal_cents = 1 where id = '${next!.id}'`,
        ),
      ).toMatch(/INVOICE_IMMUTABLE/);
      expect(
        await err(tx, `update invoices set status = 'emessa' where id = '${inv!.id}'`),
      ).toMatch(/INVOICE_IMMUTABLE/);
      expect(
        await err(
          tx,
          `update invoices set status = 'pagata', payment_method = 'pos', paid_on = current_date where id = '${next!.id}'`,
        ),
      ).toBe('OK');
      await reset(tx);
      expect(await err(tx, `delete from invoices where id = '${inv!.id}'`)).toMatch(
        /INVOICE_IMMUTABLE/,
      );
      expect(await err(tx, `update invoice_lines set description = 'x'`)).toMatch(
        /INVOICE_IMMUTABLE/,
      );
    });
  });
});

describe('concurrent numbering (10 parallel calls, committed then cleaned up)', () => {
  it('invoices: no gaps, no duplicates', async () => {
    const tag = `conc-${Date.now()}`;
    const [c] =
      await sql`insert into clients (first_name, last_name, phone) values ('Conc', ${tag}, '3339990000') returning id`;
    const [svc] = await sql`select id from services where active limit 1`;
    const bks =
      await sql`insert into bookings (client_id, service_id, day, slot, declared_member, price_applied_cents, origin, status)
      select ${c!.id}, ${svc!.id}, current_date, 'mattina', false, 100, 'telefono', 'eseguita' from generate_series(1, 10) returning id`;
    const before = (
      await sql`select coalesce((select last_number from invoice_counters where year = extract(year from now() at time zone 'Europe/Rome')), -1) as n`
    )[0]!.n as number;
    let numbers: number[] = [];
    try {
      const res = await Promise.all(
        bks.map((b) =>
          sql.begin(async (tx) => {
            await actAs(tx, 'staff', SEED_STAFF);
            const [i] = await tx.unsafe(
              `select number from issue_invoice('${c!.id}', array['${b.id}']::uuid[], null, null, null)`,
            );
            return i!.number as number;
          }),
        ),
      );
      numbers = res.sort((a, b) => a - b);
      expect(new Set(numbers).size).toBe(10);
      expect(numbers[9]! - numbers[0]!).toBe(9);
      const after = (
        await sql`select last_number as n from invoice_counters where year = extract(year from now() at time zone 'Europe/Rome')`
      )[0]!.n as number;
      expect(after - Math.max(before, 0)).toBe(10);
    } finally {
      await sql.begin(async (tx) => {
        await tx.unsafe(
          'alter table invoice_lines disable trigger user; alter table invoices disable trigger user',
        );
        await tx`delete from invoice_lines where invoice_id in (select id from invoices where client_id = ${c!.id})`;
        await tx`update bookings set invoice_id = null where client_id = ${c!.id}`;
        await tx`delete from invoices where client_id = ${c!.id}`;
        await tx.unsafe(
          'alter table invoice_lines enable trigger user; alter table invoices enable trigger user',
        );
        await tx`delete from bookings where client_id = ${c!.id}`;
        await tx`delete from clients where id = ${c!.id}`;
        if (before === -1)
          await tx`delete from invoice_counters where year = extract(year from now() at time zone 'Europe/Rome')`;
        else
          await tx`update invoice_counters set last_number = ${before} where year = extract(year from now() at time zone 'Europe/Rome')`;
      });
    }
  });

  it('members: no gaps, no duplicates', async () => {
    const before = (await sql`select last_card_number as n from org_settings`)[0]!.n as number;
    try {
      const res = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          sql.begin(async (tx) => {
            await actAs(tx, 'staff', SEED_STAFF);
            const [m] =
              await tx`select card_number from register_member(${tx.json({ first_name: 'Conc', last_name: `Test${i}` })}, 'contanti')`;
            return m!.card_number as number;
          }),
        ),
      );
      const nums = res.sort((a, b) => a - b);
      expect(new Set(nums).size).toBe(10);
      expect(nums).toEqual(Array.from({ length: 10 }, (_, i) => before + 1 + i));
      const fees = (
        await sql`select count(*)::int as n from membership_fees f join members m on m.id = f.member_id where m.last_name like 'Test_' and m.first_name = 'Conc'`
      )[0]!.n as number;
      expect(fees).toBe(10);
    } finally {
      await sql.begin(async (tx) => {
        await tx`delete from membership_fees where member_id in (select id from members where first_name = 'Conc' and last_name like 'Test_')`;
        await tx`delete from members where first_name = 'Conc' and last_name like 'Test_'`;
        await tx.unsafe('alter table org_settings disable trigger guard');
        await tx`update org_settings set last_card_number = ${before}`;
        await tx.unsafe('alter table org_settings enable trigger guard');
      });
    }
  });
});

describe('members and counters', () => {
  it('register_member numbers from the counter, adds the fee, and a failed insert does not burn a number', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await tx`update org_settings set last_card_number = 9001`;
      await actAs(tx, 'staff');
      const [m] =
        await tx`select * from register_member('{"first_name":"A","last_name":"B","tax_code":"BBBBBBBBBBBBBBBB"}'::jsonb, 'pos')`;
      expect(m!.card_number).toBe(9002);
      expect(
        (await tx`select amount_cents from membership_fees where member_id = ${m!.id}`)[0]!
          .amount_cents,
      ).toBe(2000);
      expect(
        await err(
          tx,
          `select register_member('{"first_name":"A","last_name":"B","tax_code":"BBBBBBBBBBBBBBBB"}'::jsonb)`,
        ),
      ).toMatch(/^23505/);
      const [m2] =
        await tx`select * from register_member('{"first_name":"A","last_name":"C"}'::jsonb)`;
      expect(m2!.card_number).toBe(9003);
    });
  });
  it('counters can only move upward (super admin only)', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'staff');
      expect(await err(tx, 'select app.set_member_counter(50)')).toMatch(/^42501/);
      await reset(tx);
      await actAs(tx, 'super_admin');
      expect(await err(tx, 'select app.set_member_counter(5)')).toMatch(/COUNTER_BELOW_MAX/);
      expect(await err(tx, 'select app.set_member_counter(9500)')).toBe('OK');
      expect(await err(tx, 'update org_settings set last_card_number = 1')).toMatch(
        /COUNTER_BELOW_MAX/,
      );
      expect(await err(tx, 'select app.set_invoice_counter(2020::smallint, 0)')).toMatch(
        /COUNTER_BELOW_MAX/,
      );
      expect(await err(tx, 'select app.set_invoice_counter(2020::smallint, 10)')).toBe('OK');
    });
  });
});

describe('last super admin: concurrent removal (committed, then cleaned up)', () => {
  const A = 'f0000000-0000-4000-8000-0000000000a1';
  const B = 'f0000000-0000-4000-8000-0000000000a2';
  type Op = (tx: Tx, me: string, other: string) => Promise<unknown>;
  const ops: Record<string, Op> = {
    'demote the other': (tx, _m, o) =>
      tx`update user_roles set role = 'staff' where user_id = ${o}`,
    'deactivate the other': (tx, _m, o) => tx`update profiles set active = false where id = ${o}`,
    'remove themselves': (tx, m) => tx`delete from user_roles where user_id = ${m}`,
    'deactivate themselves': (tx, m) => tx`update profiles set active = false where id = ${m}`,
  };
  it.each(Object.entries(ops))(
    'two super admins each trying to %s: at least one fails',
    async (_n, op) => {
      for (const [id, mail] of [
        [A, 'a'],
        [B, 'b'],
      ] as const) {
        await sql`insert into auth.users (id, email, aud, role) values (${id}, ${mail + '@race.test'}, 'authenticated', 'authenticated') on conflict do nothing`;
        await sql`insert into profiles (id, first_name, last_name, email) values (${id}, ${mail}, 'Race', ${mail + '@race.test'}) on conflict do nothing`;
        await sql`insert into user_roles values (${id}, 'super_admin') on conflict do nothing`;
      }
      // park every other super admin (seed, local dev users) so that A and B are the only ones (files run serially)
      const parked =
        await sql`update user_roles set role = 'staff' where role = 'super_admin' and user_id not in (${A}, ${B}) returning user_id`;
      try {
        const run = (me: string, other: string) =>
          sqlCode(
            sql.begin(async (tx) => {
              await op(tx, me, other);
              await tx`select pg_sleep(0.3)`; // keep the tx open so both overlap
            }),
          );
        const res = await Promise.all([run(A, B), run(B, A)]);
        const [row] =
          await sql`select count(*)::int as n from user_roles ur join profiles p on p.id = ur.user_id
        where ur.role = 'super_admin' and p.active and ur.user_id in (${A}, ${B})`;
        const n = row!.n;
        expect(
          res.filter((r) => r.message?.match(/LAST_SUPER_ADMIN|deadlock/)).length,
        ).toBeGreaterThanOrEqual(1);
        expect(n).toBeGreaterThanOrEqual(1);
      } finally {
        await sql`update user_roles set role = 'super_admin' where user_id in ${sql(parked.map((r) => r.user_id))}`;
        await sql`delete from user_roles where user_id in (${A}, ${B})`;
        await sql`delete from profiles where id in (${A}, ${B})`;
        await sql`delete from auth.users where id in (${A}, ${B})`;
      }
    },
  );
});

describe('last super admin', () => {
  it('cannot be demoted, deleted or deactivated; allowed with a second one', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await tx`update user_roles set role = 'staff' where role = 'super_admin' and user_id <> ${ID.admin}`; // seed admin
      const role = `update user_roles set role = 'staff' where user_id = '${ID.admin}'`;
      expect(await err(tx, role)).toMatch(/LAST_SUPER_ADMIN/);
      expect(await err(tx, `delete from user_roles where user_id = '${ID.admin}'`)).toMatch(
        /LAST_SUPER_ADMIN/,
      );
      expect(await err(tx, `update profiles set active = false where id = '${ID.admin}'`)).toMatch(
        /LAST_SUPER_ADMIN/,
      );
      await tx`update user_roles set role = 'super_admin' where user_id = ${ID.spareUser}`;
      expect(await err(tx, role)).toBe('OK');
    });
  });
  it('an inactive second admin does not count', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await tx`update user_roles set role = 'staff' where role = 'super_admin' and user_id <> ${ID.admin}`;
      await tx`update user_roles set role = 'super_admin' where user_id = ${ID.spareUser}`;
      await tx`update profiles set active = false where id = ${ID.spareUser}`;
      expect(
        await err(tx, `update user_roles set role = 'staff' where user_id = '${ID.admin}'`),
      ).toMatch(/LAST_SUPER_ADMIN/);
    });
  });
  it('only super admin can change activation', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'staff');
      expect(await err(tx, `update profiles set active = false where id = '${ID.vol}'`)).toMatch(
        /^42501/,
      );
      await reset(tx);
      await actAs(tx, 'super_admin');
      expect(await err(tx, `update profiles set active = false where id = '${ID.vol}'`)).toBe('OK');
    });
  });
});

describe('public functions', () => {
  const book = (day: string, svc = 'fa000000-0000-4000-8000-000000000001', member = 'false') =>
    `select submit_public_booking('Zed', 'Client', '333 111 2222', '${svc}', ${day}, 'mattina', ${member})`;
  const futureDay =
    "(select d from generate_series(current_date + 1, current_date + 8, '1 day') d where extract(isodow from d) <> 7 limit 1)::date";
  const sunday =
    "(select d from generate_series(current_date + 1, current_date + 8, '1 day') d where extract(isodow from d) = 7)::date";
  it('anon booking attaches to existing client, snapshots price, validates inputs', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'anon');
      expect(await err(tx, book(futureDay))).toBe('OK');
      expect(await err(tx, book(futureDay, 'fa000000-0000-4000-8000-000000000001', 'true'))).toBe(
        'OK',
      );
      expect(await err(tx, book('current_date'))).toMatch(/INVALID_DAY/);
      expect(await err(tx, book('current_date + 90'))).toMatch(/INVALID_DAY/);
      expect(await err(tx, book(sunday))).toMatch(/INVALID_DAY/);
      expect(await err(tx, book(futureDay, 'fa000000-0000-4000-8000-000000000002'))).toMatch(
        /SERVICE_NOT_BOOKABLE/,
      );
      await reset(tx);
      const rows =
        await tx`select client_id, price_applied_cents, status, origin from bookings where client_id = ${CLIENT} order by price_applied_cents`;
      expect(rows.map((r) => r.price_applied_cents)).toEqual([0, 300, 300]);
      expect(rows.at(-1)).toMatchObject({ status: 'attesa', origin: 'online' }); // fixture booking is 'eseguita'
      expect(
        (await tx`select count(*)::int as n from clients where phone_normalized = '3331112222'`)[0]!
          .n,
      ).toBe(1);
    });
  });
  it('booking a transport service creates a richiesto transport', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await tx`update services set requires_transport = true where id = 'fa000000-0000-4000-8000-000000000001'`;
      await actAs(tx, 'anon');
      const [r] = await tx.unsafe(book(futureDay));
      await reset(tx);
      const t =
        await tx`select status, driver_volunteer_id, from_address from transports where booking_id = ${Object.values(r!)[0] as string}`;
      expect(t).toEqual([{ status: 'richiesto', driver_volunteer_id: null, from_address: null }]);
    });
  });
  it('anon proposal submission works; direct insert is denied', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'anon');
      expect(
        await err(
          tx,
          `select submit_post_proposal('t', 'avviso', null, null, 'body', null, null, 'Nome', null)`,
        ),
      ).toBe('OK');
      expect(
        await err(
          tx,
          `select submit_post_proposal('', 'avviso', null, null, 'body', null, null, 'Nome', null)`,
        ),
      ).toMatch(/INVALID_INPUT/);
    });
  });
  it('rate limit: service only, third hit over the limit', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      const hit = async () =>
        Object.values((await tx.unsafe(`select app.consume_rate_limit('k-test', 2, 60)`))[0]!)[0];
      expect([await hit(), await hit(), await hit()]).toEqual([true, true, false]);
      await actAs(tx, 'anon');
      expect(await err(tx, `select app.consume_rate_limit('k', 2, 60)`)).toMatch(/^42501/);
    });
  });
});

describe('volunteer functions', () => {
  it('respond/complete only on own rows', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'volontario');
      expect(
        await err(
          tx,
          `select respond_shift_assignment('f6000000-0000-4000-8000-000000000002', true)`,
        ),
      ).toMatch(/ASSIGNMENT_NOT_FOUND/);
      expect(
        await err(
          tx,
          `select respond_shift_assignment('f6000000-0000-4000-8000-000000000001', true)`,
        ),
      ).toBe('OK');
      expect(
        await err(
          tx,
          `select complete_transport('fc000000-0000-4000-8000-000000000001', 12.5, 'ok')`,
        ),
      ).toBe('OK');
      expect(
        await err(
          tx,
          `select complete_transport('fc000000-0000-4000-8000-000000000001', 12.5, 'ok')`,
        ),
      ).toMatch(/TRANSPORT_NOT_COMPLETABLE/);
      expect(await err(tx, `select update_my_profile('0123456')`)).toBe('OK');
      await reset(tx);
      expect(
        (
          await tx`select status from shift_assignments where id = 'f6000000-0000-4000-8000-000000000001'`
        )[0]!.status,
      ).toBe('confermato');
      expect((await tx`select phone from profiles where id = ${ID.vol}`)[0]!.phone).toBe('0123456');
      expect(
        (
          await tx`select status, km from transports where id = 'fc000000-0000-4000-8000-000000000001'`
        )[0],
      ).toMatchObject({ status: 'svolto' });
    });
  });
  it('another volunteer cannot respond to a transport; rejecting clears driver', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'volontario', ID.vol2);
      expect(
        await err(tx, `select respond_transport('fc000000-0000-4000-8000-000000000001', true)`),
      ).toMatch(/TRANSPORT_NOT_FOUND/);
      await reset(tx);
      await actAs(tx, 'volontario', ID.vol);
      expect(
        await err(tx, `select respond_transport('fc000000-0000-4000-8000-000000000001', false)`),
      ).toBe('OK');
      await reset(tx);
      expect(
        (
          await tx`select status, driver_volunteer_id from transports where id = 'fc000000-0000-4000-8000-000000000001'`
        )[0],
      ).toEqual({ status: 'richiesto', driver_volunteer_id: null });
      expect(
        (
          await tx`select count(*)::int as n from volunteer_commitments where transport_id = 'fc000000-0000-4000-8000-000000000001'`
        )[0]!.n,
      ).toBe(0);
    });
  });
  it('anon cannot call volunteer functions', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'anon');
      expect(await err(tx, `select update_my_profile('1')`)).toMatch(/^42501/);
    });
  });
});

describe('audit', () => {
  it('records actor and role for audited tables', async () => {
    await rolledBack(async (tx) => {
      await world(tx);
      await actAs(tx, 'staff');
      await tx`update members set notes = 'x' where id = 'f7000000-0000-4000-8000-000000000001'`;
      await reset(tx);
      const rows =
        await tx`select actor_id, actor_role, action, before->>'notes' as b, after->>'notes' as a from audit_log
        where table_name = 'members' and row_id = 'f7000000-0000-4000-8000-000000000001' and action = 'update'`;
      expect(rows).toEqual([
        { actor_id: ID.staff, actor_role: 'staff', action: 'update', b: null, a: 'x' },
      ]);
    });
  });
});
