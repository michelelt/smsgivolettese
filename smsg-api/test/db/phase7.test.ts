/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from Auth/SQL */
import { afterAll, describe, expect, it } from 'vitest';
import { ID, actAs, attempt, fixtures, rolledBack, sql, type Role } from './helpers';

afterAll(() => sql.end());

const MEMBER = 'f7000000-0000-4000-8000-000000000001';
const INVOICE = 'fd000000-0000-4000-8000-000000000001';
const call = (fn: string, ...args: string[]) => `select app.${fn}(${args.join(', ')}) as r`;
const member = (fn: string) => call(fn, `'${MEMBER}'`);
const cessato = `update members set status = 'cessato', ended_on = current_date where id = '${MEMBER}'`;

describe('phase 7 functions: only super_admin', () => {
  const denied: Role[] = ['anon', 'volontario', 'staff'];
  const cases: [string, string][] = [
    ['gdpr_export', call('gdpr_export', `'member'`, `'${MEMBER}'`)],
    ['anonymize_member', member('anonymize_member')],
    ['anonymize_user', call('anonymize_user', `'${ID.vol2}'`)],
  ];
  for (const [name, stmt] of cases) {
    for (const role of denied) {
      it(`${name} denied to ${role}`, async () => {
        await rolledBack(async (tx) => {
          await fixtures(tx);
          await tx.unsafe(cessato);
          await actAs(tx, role);
          const o = await attempt(tx, stmt);
          expect(o.ok).toBe(false);
          expect(o.code).toBe('42501');
        });
      });
    }
    it(`${name} allowed to super_admin`, async () => {
      await rolledBack(async (tx) => {
        await fixtures(tx);
        await tx.unsafe(cessato);
        await actAs(tx, 'super_admin');
        expect((await attempt(tx, stmt)).ok).toBe(true);
      });
    });
  }
});

describe('gdpr_export', () => {
  it('exports a member with invoices and audits the export', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'super_admin');
      const [{ r }] = (await tx.unsafe(
        call('gdpr_export', `'member'`, `'${MEMBER}'`),
      )) as unknown as [{ r: any }];
      expect(r.subject).toBe('member');
      expect(r.member.id).toBe(MEMBER);
      expect(r.membershipFees).toHaveLength(2);
      expect(r.transports).toHaveLength(3);
      expect(r.invoices[0].lines).toHaveLength(1);
      expect(r.transports[0]).not.toHaveProperty('driver_volunteer_id');
      expect(r.transports[0]).not.toHaveProperty('created_by');
      expect(r.invoices[0]).not.toHaveProperty('created_by');
      expect(r.membershipFees[0]).not.toHaveProperty('recorded_by');
      await tx.unsafe('reset role');
      const a =
        await tx`select actor_id, actor_role, action from audit_log where action = 'export' and row_id = ${MEMBER}`;
      expect(a).toEqual([{ actor_id: ID.admin, actor_role: 'super_admin', action: 'export' }]);
    });
  });
  it('exports a user without other people data and rejects bad input', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'super_admin');
      const [{ r }] = (await tx.unsafe(
        call('gdpr_export', `'user'`, `'${ID.vol}'`),
      )) as unknown as [{ r: any }];
      expect(r.profile.id).toBe(ID.vol);
      expect(r.role).toBe('volontario');
      expect(r.shiftAssignments).toHaveLength(1);
      expect(r.transportsAsDriver).toHaveLength(2);
      expect(Object.keys(r.transportsAsDriver[0]).sort()).toEqual([
        'driverNotes',
        'id',
        'km',
        'status',
        'travelDate',
      ]);
      expect((await attempt(tx, call('gdpr_export', `'x'`, `'${ID.vol}'`))).message).toContain(
        'INVALID_SUBJECT',
      );
      expect((await attempt(tx, call('gdpr_export', `'user'`, `'${MEMBER}'`))).message).toContain(
        'USER_NOT_FOUND',
      );
    });
  });
});

describe('anonymize_member', () => {
  it('refuses an active member', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'super_admin');
      expect((await attempt(tx, member('anonymize_member'))).message).toContain('MEMBER_ACTIVE');
    });
  });
  it('clears personal data, keeps invoices and their audit, redacts the rest, is idempotent', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(`update members set status = 'cessato', ended_on = current_date, phone = '123', notes = 'n',
        tax_code = 'RSSMRA80A01H501U' where id = '${MEMBER}'`);
      await tx.unsafe(
        `update transports set notes = 'secret', contact_phone = '123', driver_notes = 'd' where member_id = '${MEMBER}'`,
      );
      await actAs(tx, 'super_admin');
      const [{ r }] = (await tx.unsafe(member('anonymize_member'))) as unknown as [{ r: any }];
      expect(r.retainedInvoices).toEqual([{ id: INVOICE, year: 2020, number: 1 }]);
      await tx.unsafe('reset role');
      const [m] = await tx`select * from members where id = ${MEMBER}`;
      expect(m).toMatchObject({
        first_name: 'Anonimo',
        last_name: 'Anonimo',
        tax_code: null,
        phone: null,
        notes: null,
        card_number: 9001,
      });
      expect(m!.anonymized_at).not.toBeNull();
      const t =
        await tx`select notes, contact_phone, driver_notes, from_address from transports where member_id = ${MEMBER}`;
      expect(
        t.every(
          (x) =>
            x.notes === null &&
            x.contact_phone === null &&
            x.driver_notes === null &&
            x.from_address === '(anonimizzato)',
        ),
      ).toBe(true);
      expect(
        await tx`select customer_name, total_cents from invoices where id = ${INVOICE}`,
      ).toEqual([{ customer_name: 'C', total_cents: 300 }]);
      expect(
        await tx`select count(*)::int as n from membership_fees where member_id = ${MEMBER}`,
      ).toEqual([{ n: 2 }]);
      const red = await tx`select redacted, before is null and after is null as empty from audit_log
        where (table_name = 'members' and row_id = ${MEMBER})
           or (table_name in ('membership_fees','transports') and (after ->> 'member_id' = ${MEMBER} or before ->> 'member_id' = ${MEMBER}))`;
      expect(red.length).toBeGreaterThan(2);
      expect(red.every((x) => x.redacted && x.empty)).toBe(true);
      const inv =
        await tx`select redacted, after is not null as has from audit_log where table_name in ('invoices','invoice_lines')
        and (row_id = ${INVOICE} or after ->> 'invoice_id' = ${INVOICE})`;
      expect(inv.length).toBeGreaterThan(0);
      expect(inv.every((x) => !x.redacted && x.has)).toBe(true);
      const before = (await tx`select count(*)::int as n from audit_log`)[0]!.n;
      await actAs(tx, 'super_admin');
      const [{ r: r2 }] = (await tx.unsafe(member('anonymize_member'))) as unknown as [{ r: any }];
      expect(r2).toEqual(r);
      await tx.unsafe('reset role');
      expect((await tx`select count(*)::int as n from audit_log`)[0]!.n).toBe(before);
    });
  });
});

describe('anonymize_user', () => {
  it('refuses self', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'super_admin');
      expect((await attempt(tx, call('anonymize_user', `'${ID.admin}'`))).message).toContain(
        'SELF_FORBIDDEN',
      );
    });
  });
  it('refuses a driver with future transports', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'super_admin');
      expect((await attempt(tx, call('anonymize_user', `'${ID.vol}'`))).message).toContain(
        'DRIVER_HAS_FUTURE_TRANSPORTS',
      );
    });
  });
  it('anonymises a volunteer, redacts audit, drops password marker, is idempotent', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(`insert into app.password_set values ('${ID.vol2}') on conflict do nothing`);
      await tx.unsafe(`update profiles set phone = '555' where id = '${ID.vol2}'`);
      await actAs(tx, 'super_admin');
      const [{ r }] = (await tx.unsafe(call('anonymize_user', `'${ID.vol2}'`))) as unknown as [
        { r: any },
      ];
      expect(r).toEqual({ retainedInvoices: [] });
      await tx.unsafe('reset role');
      const [p] =
        await tx`select first_name, last_name, phone, email, active, anonymized_at from profiles where id = ${ID.vol2}`;
      expect(p).toMatchObject({
        first_name: 'Anonimo',
        phone: null,
        email: `deleted+${ID.vol2}@invalid.local`,
        active: false,
      });
      expect(p!.anonymized_at).not.toBeNull();
      expect(
        await tx`select 1 from availability_rules where volunteer_id = ${ID.vol2}`,
      ).toHaveLength(0);
      expect(
        await tx`select 1 from availability_exceptions where volunteer_id = ${ID.vol2}`,
      ).toHaveLength(0);
      expect(
        await tx`select 1 from shift_assignments where volunteer_id = ${ID.vol2}`,
      ).toHaveLength(0);
      expect(await tx`select 1 from app.password_set where user_id = ${ID.vol2}`).toHaveLength(0);
      expect(await tx`select active, can_drive from volunteers where id = ${ID.vol2}`).toEqual([
        { active: false, can_drive: false },
      ]);
      const red = await tx`select redacted, before is null and after is null as empty from audit_log
        where table_name in ('profiles','volunteers','user_roles') and row_id = ${ID.vol2}`;
      expect(red.length).toBeGreaterThan(0);
      expect(red.every((x) => x.redacted && x.empty)).toBe(true);
      await actAs(tx, 'super_admin');
      expect((await attempt(tx, call('anonymize_user', `'${ID.vol2}'`))).ok).toBe(true);
    });
  });
  it('keeps the last super admin guard', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(
        `update user_roles set role = 'staff' where role = 'super_admin' and user_id <> '${ID.admin}'`,
      ); // seed super admin
      // caller claims super_admin but is not an active super admin in the table: the target is the last one
      await actAs(tx, 'super_admin', ID.staff);
      expect((await attempt(tx, call('anonymize_user', `'${ID.admin}'`))).message).toContain(
        'LAST_SUPER_ADMIN',
      );
    });
  });
  it('allows anonymising a super admin when another exists', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(`update user_roles set role = 'super_admin' where user_id = '${ID.staff}'`);
      await actAs(tx, 'super_admin', ID.staff);
      expect((await attempt(tx, call('anonymize_user', `'${ID.admin}'`))).ok).toBe(true);
    });
  });
});

describe('audit_log guard and audit coverage', () => {
  it('refuses delete and non-redaction updates, allows redaction', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      const [{ id }] =
        (await tx`select id from audit_log where table_name = 'members' limit 1`) as unknown as [
          { id: number },
        ];
      expect((await attempt(tx, `delete from audit_log where id = ${id}`)).message).toContain(
        'AUDIT_IMMUTABLE',
      );
      expect(
        (await attempt(tx, `update audit_log set table_name = 'x' where id = ${id}`)).message,
      ).toContain('AUDIT_IMMUTABLE');
      expect(
        (await attempt(tx, `update audit_log set redacted = true where id = ${id}`)).message,
      ).toContain('AUDIT_IMMUTABLE');
      expect(
        (
          await attempt(
            tx,
            `update audit_log set redacted = true, before = null, after = null where id = ${id}`,
          )
        ).ok,
      ).toBe(true);
      expect(
        (await attempt(tx, `update audit_log set redacted = false where id = ${id}`)).message,
      ).toContain('AUDIT_IMMUTABLE');
    });
  });
  it('audits media insert and delete', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(`delete from media where id = 'fe000000-0000-4000-8000-000000000003'`);
      const a =
        await tx`select action from audit_log where table_name = 'media' and row_id = 'fe000000-0000-4000-8000-000000000003' order by id`;
      expect(a.map((x) => x.action)).toEqual(['insert', 'delete']);
    });
  });
});

describe('audit_log truncate', () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    it(`${role} cannot truncate`, async () => {
      await rolledBack(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        const o = await attempt(tx, 'truncate public.audit_log');
        expect(o.ok).toBe(false);
        expect(o.code).toBe('42501');
      });
    });
  }
});

describe('access token hook with TOTP', () => {
  const claims = async (
    tx: Parameters<Parameters<typeof rolledBack>[0]>[0],
    id: string,
    method: string,
    amr: string[] = [],
  ) => {
    const event = {
      user_id: id,
      authentication_method: method,
      claims: { sub: id, role: 'authenticated', amr: amr.map((m) => ({ method: m })) },
    };
    const [r] = await tx`select app.custom_access_token_hook(${tx.json(event)}) as e`;
    return r!.e;
  };
  it('lets staff/super_admin through with totp, still refuses otp/magiclink/recovery', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx`insert into app.password_set values (${ID.admin}), (${ID.staff}) on conflict do nothing`;
      for (const id of [ID.admin, ID.staff]) {
        expect((await claims(tx, id, 'totp', ['password', 'totp'])).claims.app_role).toBeTruthy();
        expect((await claims(tx, id, 'mfa/totp')).claims.app_role).toBeTruthy();
        for (const m of ['otp', 'magiclink', 'recovery', 'invite'])
          expect((await claims(tx, id, m)).error?.http_code).toBe(403);
      }
    });
  });
});

describe('password_set FK', () => {
  it('cascades with auth.users and rejects orphans', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx`insert into app.password_set values (${ID.noRole}) on conflict do nothing`;
      await tx`delete from profiles where id = ${ID.noRole}`;
      await tx`delete from auth.users where id = ${ID.noRole}`;
      expect(await tx`select 1 from app.password_set where user_id = ${ID.noRole}`).toHaveLength(0);
      expect(
        (
          await attempt(
            tx,
            `insert into app.password_set values ('f0000000-0000-4000-8000-0000000000ff')`,
          )
        ).ok,
      ).toBe(false);
    });
  });
});
