import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const sent = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock('../../src/lib/email.js', () => ({
  emailEnabled: () => true,
  sendEmail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    sent.push(m);
    return true;
  }),
}));

import { app } from '../../src/app.js';
import { db } from '../../src/lib/db.js';
import { env } from '../../src/config/env.js';
import { DB_URL, sql } from '../db/helpers.js';

const tag = Date.now().toString(36);
const mail = (n: string) => `zzp-${n}-${tag}@t.test`;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
const realFetch = globalThis.fetch;
const tokens: Record<string, string> = {};
type K = 'staff' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
const ids = {} as Record<K, string>;

const romeToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const today = romeToday();
const tomorrow = addDays(today, 1);
let monday = addDays(today, 14);
while (new Date(`${monday}T00:00:00Z`).getUTCDay() !== 1) monday = addDays(monday, 1);

async function token(sub: string, role: string) {
  return new SignJWT({ app_role: role })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject(sub)
    .setIssuer(`${env.SUPABASE_URL}/auth/v1`)
    .setAudience('authenticated')
    .setExpirationTime('10m')
    .sign(keys.privateKey);
}

async function mkUser(
  key: K,
  last: string,
  role: string,
  vol?: { drive?: boolean; licence?: string },
) {
  const id = crypto.randomUUID();
  ids[key] = id;
  await sql`insert into auth.users (id, email, aud, role) values (${id}, ${mail(key)}, 'authenticated', 'authenticated')`;
  await sql`insert into profiles (id, first_name, last_name, email) values (${id}, 'ZZP', ${last}, ${mail(key)})`;
  await sql`insert into user_roles (user_id, role) values (${id}, ${role}::app_role)`;
  if (vol)
    await sql`insert into volunteers (id, can_drive, license_expires_on)
              values (${id}, ${vol.drive ?? false}, ${vol.drive ? (vol.licence ?? addDays(today, 400)) : null})`;
  tokens[key] = await token(id, role);
}

async function cleanup() {
  await sql.begin(async (t) => {
    await t`set local session_replication_role = replica`;
    const zu = t`select id from auth.users where email like 'zzp-%@t.test'`;
    const zc = t`select id from members where first_name = 'ZZP'`;
    await t`delete from transports where member_id in (${zc})`;
    await t`delete from membership_fees where member_id in (${zc})`;
    await t`delete from members where first_name = 'ZZP'`;
    await t`delete from services where name like 'ZZP%'`;
    await t`delete from shifts where shift_type_id in (select id from shift_types where name like 'ZZP%')`;
    await t`delete from shift_types where name like 'ZZP%'`;
    await t`delete from vehicles where plate like 'ZZP%'`;
    // audit_log is append-only (ADR-066): test rows are left behind, queries filter by request_id/actor
    await t`delete from volunteers where id in (${zu})`;
    await t`delete from user_roles where user_id in (${zu})`;
    await t`delete from profiles where id in (${zu})`;
    await t`delete from auth.users where email like 'zzp-%@t.test'`;
  });
}

beforeAll(async () => {
  const local = (u: string) => ['127.0.0.1', 'localhost'].includes(new URL(u).hostname);
  if (env.DATABASE_URL !== DB_URL || !local(env.DATABASE_URL) || !local(DB_URL))
    throw new Error('phase 5 tests need DATABASE_URL === TEST_DATABASE_URL on 127.0.0.1/localhost');
  await cleanup();
  keys = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'ES256' };
  vi.stubGlobal('fetch', (u: string | URL | Request, i?: RequestInit) =>
    String(u).endsWith('jwks.json')
      ? Promise.resolve(Response.json({ keys: [jwk] }))
      : realFetch(u, i),
  );
  await mkUser('staff', 'Staff', 'staff');
  await mkUser('a', 'Zeta', 'volontario', { drive: true });
  await mkUser('b', 'Aaa', 'volontario', { drive: true });
  await mkUser('f', 'Bbb', 'volontario', { drive: true });
  await mkUser('c', 'Ccc', 'volontario', { drive: true });
  await mkUser('d', 'Ddd', 'volontario', { drive: true });
  await mkUser('e', 'Eee', 'volontario', { drive: true });
  await mkUser('g', 'Ggg', 'volontario', { drive: false });
  await mkUser('h', 'Hhh', 'volontario', { drive: true, licence: addDays(today, -1) });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanup();
  await db.end();
  await sql.end();
});

type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(
  who: string | null,
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
const staff = (m: string, p: string, b?: unknown) => call('staff', m, p, b);
const mailsTo = (key: K) => sent.filter((m) => m.to === mail(key));

let shiftType: string;
const mkShift = async (day: string, startTime: string, endTime: string, requiredSlots = 2) =>
  (
    await staff('POST', '/shifts', {
      shiftTypeId: shiftType,
      day,
      startTime,
      endTime,
      requiredSlots,
    })
  ).data;
const assign = (shiftId: string, who: K) =>
  staff('POST', `/shifts/${shiftId}/assignments`, { volunteerId: ids[who] });

describe('permissions', () => {
  const routes: [string, string][] = [
    ['GET', `/shifts?from=${today}&to=${today}`],
    ['POST', '/shifts'],
    ['GET', '/shift-types'],
    ['GET', `/transports?from=${today}&to=${today}`],
    ['POST', '/transports'],
    ['GET', '/transports/export.csv?month=2026-01'],
    ['GET', `/transports/${crypto.randomUUID()}/sheet.pdf`],
    ['GET', '/volunteers'],
    ['GET', '/availability'],
    ['GET', '/vehicles'],
    ['POST', '/users/invite'],
  ];
  it('volunteers get 403 and anonymous 401 on staff routes', async () => {
    for (const [m, p] of routes) {
      expect((await call('a', m, p, m === 'GET' ? undefined : {})).status, `${m} ${p}`).toBe(403);
      expect((await call(null, m, p, m === 'GET' ? undefined : {})).status, `${m} ${p}`).toBe(401);
    }
  });
});

describe('shifts', () => {
  it('creates a type and shifts, lists with coverage, patches and validates', async () => {
    const t = await staff('POST', '/shift-types', { name: `ZZP ${tag}` });
    expect(t.status).toBe(201);
    shiftType = t.data.id;
    expect((await staff('POST', '/shift-types', { name: `ZZP ${tag}` })).data.error.code).toBe(
      'SHIFT_TYPE_EXISTS',
    );
    const s = await mkShift(monday, '09:00', '11:00');
    expect(s).toMatchObject({
      day: monday,
      startTime: '09:00',
      endTime: '11:00',
      coverage: 'scoperto',
      filled: 0,
    });
    const bad = await staff('POST', '/shifts', {
      shiftTypeId: shiftType,
      day: monday,
      startTime: '11:00',
      endTime: '09:00',
      requiredSlots: 1,
    });
    expect(bad.status).toBe(400);
    const list = await staff('GET', `/shifts?from=${monday}&to=${monday}`);
    expect(list.data.items.map((i: J) => i.id)).toContain(s.id);
    expect((await staff('GET', `/shifts?from=${monday}&to=${addDays(monday, 60)}`)).status).toBe(
      400,
    );
    const p = await staff('PATCH', `/shifts/${s.id}`, { endTime: '12:00', notes: 'x' });
    expect(p.data).toMatchObject({ startTime: '09:00', endTime: '12:00', notes: 'x' });
    await staff('PATCH', `/shifts/${s.id}`, { endTime: '11:00', notes: null });
  });

  it('candidates carry labels and are sorted by status, monthly load, last name', async () => {
    const s1 = (await staff('GET', `/shifts?from=${monday}&to=${monday}`)).data.items[0];
    const s2 = await mkShift(monday, '10:00', '12:00'); // overlaps s1
    const s3 = await mkShift(monday, '15:00', '16:00'); // same month, no overlap
    await sql`insert into availability_rules (volunteer_id, weekday, start_time, end_time) values
      (${ids.a}, 1, '08:00', '12:00'), (${ids.c}, 2, '08:00', '12:00')`;
    await sql`insert into availability_exceptions (volunteer_id, starts_on, ends_on, kind)
      values (${ids.d}, ${monday}, ${monday}, 'assente')`;
    expect((await assign(s2.id, 'e')).status).toBe(201);
    expect((await assign(s3.id, 'b')).status).toBe(201);
    const r = await staff('GET', `/shifts/${s1.id}/candidates`);
    expect(r.status).toBe(200);
    const mine = r.data.items.filter((c: J) => c.firstName === 'ZZP');
    expect(mine.map((c: J) => [c.lastName, c.status, c.selectable, c.commitmentsInMonth])).toEqual([
      ['Zeta', 'disponibile', true, 0],
      ['Bbb', 'non_indicata', true, 0],
      ['Ggg', 'non_indicata', true, 0],
      ['Hhh', 'non_indicata', true, 0],
      ['Aaa', 'non_indicata', true, 1],
      ['Ccc', 'non_disponibile', true, 0],
      ['Eee', 'gia_impegnato', false, 1],
      ['Ddd', 'assente', false, 0],
    ]);
  });

  it('assign: absent, duplicate, overlap, inactive; unassign and re-propose', async () => {
    const s1 = (await staff('GET', `/shifts?from=${monday}&to=${monday}`)).data.items.find(
      (i: J) => i.startTime === '09:00',
    );
    expect((await assign(s1.id, 'd')).data.error.code).toBe('VOLUNTEER_ABSENT');
    const a = await assign(s1.id, 'a');
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({ status: 'proposto', lastName: 'Zeta' });
    expect(mailsTo('a').at(-1)?.subject).toBe('Nuovo impegno assegnato');
    expect((await assign(s1.id, 'a')).data.error.code).toBe('ALREADY_ASSIGNED');
    // forced overlap: e is already on the 10:00-12:00 shift
    const ov = await assign(s1.id, 'e');
    expect(ov.status).toBe(409);
    expect(ov.data.error.code).toBe('COMMITMENT_OVERLAP');
    await sql`update volunteers set active = false where id = ${ids.f}`;
    expect((await assign(s1.id, 'f')).data.error.code).toBe('VOLUNTEER_INACTIVE');
    await sql`update volunteers set active = true where id = ${ids.f}`;
    // refusal by the volunteer, staff notified, then staff re-propose
    const before = sent.length;
    const ref = await call('a', 'POST', `/me/shift-assignments/${a.data.id}/respond`, {
      accept: false,
    });
    expect(ref.status).toBe(204);
    expect(
      sent.slice(before).some((m) => m.to === mail('staff') && m.subject === 'Impegno rifiutato'),
    ).toBe(true);
    expect(
      (await call('a', 'POST', `/me/shift-assignments/${a.data.id}/respond`, { accept: true }))
        .status,
    ).toBe(409);
    const again = await assign(s1.id, 'a');
    expect(again.status).toBe(201);
    expect(again.data.id).toBe(a.data.id);
    expect(again.data.status).toBe('proposto');
    const un = await staff('DELETE', `/shifts/${s1.id}/assignments/${a.data.id}`);
    expect(un.status).toBe(204);
    expect(mailsTo('a').at(-1)?.subject).toBe('Impegno annullato');
    expect((await staff('DELETE', `/shifts/${s1.id}/assignments/${a.data.id}`)).status).toBe(404);
  });

  it('copy-week copies without assignments and skips existing shifts', async () => {
    const next = addDays(monday, 7);
    const first = await staff('POST', '/shifts/copy-week', { fromWeek: monday, toWeek: next });
    expect(first.data).toEqual({ created: 3, skipped: 0 });
    const copied = (await staff('GET', `/shifts?from=${next}&to=${next}`)).data.items;
    expect(copied).toHaveLength(3);
    expect(copied.every((s: J) => s.assignments.length === 0)).toBe(true);
    const second = await staff('POST', '/shifts/copy-week', { fromWeek: monday, toWeek: next });
    expect(second.data).toEqual({ created: 0, skipped: 3 });
    expect(
      (await staff('POST', '/shifts/copy-week', { fromWeek: addDays(monday, 1), toWeek: next }))
        .status,
    ).toBe(400);
    expect(
      (await staff('POST', '/shifts/copy-week', { fromWeek: monday, toWeek: monday })).status,
    ).toBe(400);
  });

  it('deleting a shift emails live volunteers', async () => {
    const s = await mkShift(addDays(monday, 21), '09:00', '10:00');
    await assign(s.id, 'b');
    expect((await staff('DELETE', `/shifts/${s.id}`)).status).toBe(204);
    expect(mailsTo('b').at(-1)?.subject).toBe('Impegno annullato');
    expect((await staff('GET', `/shifts/${s.id}`)).status).toBe(404);
  });
});

describe('vehicles and volunteers', () => {
  it('normalises plates and rejects duplicates', async () => {
    const p = `ZZP${tag}`.toUpperCase().slice(0, 9);
    const v = await staff('POST', '/vehicles', {
      plate: p.toLowerCase().replace('zzp', 'zz p'),
      model: 'Doblò',
      seats: 5,
    });
    expect(v.status).toBe(201);
    expect(v.data.plate).toBe(p);
    expect(
      (await staff('POST', '/vehicles', { plate: p, model: 'x', seats: 4 })).data.error.code,
    ).toBe('VEHICLE_PLATE_EXISTS');
    expect(
      (await staff('PATCH', `/vehicles/${v.data.id}`, { wheelchairAccessible: true })).data
        .wheelchairAccessible,
    ).toBe(true);
  });
  it('lists, reads and patches volunteers; overview lists rules', async () => {
    const l = await staff('GET', '/volunteers?q=Zeta');
    expect(l.data.items.some((v: J) => v.id === ids.a)).toBe(true);
    const p = await staff('PATCH', `/volunteers/${ids.g}`, { phone: '3331112222', notes: 'n' });
    expect(p.data).toMatchObject({ phone: '3331112222', notes: 'n', rules: [], absences: [] });
    await call('a', 'POST', '/me/absences', { startsOn: monday, endsOn: monday, note: 'ricovero' });
    const ov = await staff('GET', '/availability');
    const a = ov.data.items.find((i: J) => i.volunteerId === ids.a);
    expect(a.rules).toEqual([{ weekday: 1, startTime: '08:00', endTime: '12:00' }]);
    expect(typeof a.canDrive).toBe('boolean');
    // absence dates only, never the note (ADR-071 review)
    expect(a.absences.length).toBeGreaterThan(0);
    for (const x of a.absences as J[]) expect(x).not.toHaveProperty('note');
    expect(a).not.toHaveProperty('email');
  });
});

describe('me', () => {
  it('availability: overlap rejected, set replaces', async () => {
    const bad = await call('b', 'PUT', '/me/availability', {
      rules: [
        { weekday: 1, startTime: '08:00', endTime: '12:00' },
        { weekday: 1, startTime: '11:00', endTime: '13:00' },
      ],
    });
    expect(bad.status).toBe(400);
    const ok = await call('b', 'PUT', '/me/availability', {
      rules: [{ weekday: 3, startTime: '14:00', endTime: '18:00' }],
    });
    expect(ok.data.rules).toEqual([{ weekday: 3, startTime: '14:00', endTime: '18:00' }]);
    expect((await call('b', 'GET', '/me/availability')).data.rules).toHaveLength(1);
  });
  it('absences: counts conflicts, lists, deletes', async () => {
    // b has the 15:00 shift on `monday`
    const r = await call('b', 'POST', '/me/absences', {
      startsOn: monday,
      endsOn: monday,
      note: 'ferie',
    });
    expect(r.status).toBe(201);
    expect(r.data.conflictingCommitments).toBe(1);
    expect(
      (
        await call('b', 'POST', '/me/absences', {
          startsOn: addDays(today, -3),
          endsOn: addDays(today, -2),
        })
      ).status,
    ).toBe(400);
    expect((await call('b', 'GET', '/me/absences')).data.items.map((a: J) => a.id)).toContain(
      r.data.id,
    );
    expect((await call('b', 'DELETE', `/me/absences/${r.data.id}`)).status).toBe(204);
    expect((await call('b', 'DELETE', `/me/absences/${r.data.id}`)).status).toBe(404);
    expect((await call('c', 'DELETE', `/me/absences/${r.data.id}`)).status).toBe(404);
  });
});

describe('transports', () => {
  let member: string;
  const mkTransport = async (extra: object = {}) =>
    (
      await staff('POST', '/transports', {
        memberId: member,
        travelDate: tomorrow,
        departureTime: '08:00',
        returnTime: '10:00',
        fromAddress: 'Via Roma 1',
        toAddress: 'Ospedale',
        contactPhone: '3331234567',
        notes: 'nota staff riservata',
        wheelchair: false,
        mobilityAids: false,
        companions: 0,
        ...extra,
      })
    ).data;

  beforeAll(async () => {
    member = (
      await staff('POST', '/members', {
        firstName: 'ZZP',
        lastName: `C${tag}`,
        phone: '3330000000',
      })
    ).data.id;
  });

  it('create/patch rules; assign needs departure and addresses', async () => {
    const bare = await staff('POST', '/transports', {
      memberId: member,
      travelDate: tomorrow,
      appointmentTime: '10:00',
    });
    expect(bare.status).toBe(201);
    expect(
      (await staff('POST', '/transports', { memberId: member, travelDate: tomorrow })).status,
    ).toBe(400); // neither departure nor appointment
    const inc = await staff('POST', `/transports/${bare.data.id}/assign`, { driverId: ids.a });
    expect(inc.status).toBe(422);
    expect(inc.data.error.code).toBe('TRANSPORT_INCOMPLETE');
    expect((await staff('GET', `/transports/${bare.data.id}/candidates`)).data.error.code).toBe(
      'TRANSPORT_INCOMPLETE',
    );
    expect(
      (
        await staff('POST', '/transports', {
          memberId: crypto.randomUUID(),
          travelDate: tomorrow,
          departureTime: '08:00',
        })
      ).data.error.code,
    ).toBe('MEMBER_NOT_FOUND');
    const p = await staff('PATCH', `/transports/${bare.data.id}`, {
      departureTime: '14:00',
      fromAddress: 'A',
      toAddress: 'B',
    });
    expect(p.data).toMatchObject({ departureTime: '14:00', fromAddress: 'A', status: 'richiesto' });
    await staff('POST', `/transports/${bare.data.id}/cancel`);
    expect(
      (await staff('PATCH', `/transports/${bare.data.id}`, { notes: 'x' })).data.error.code,
    ).toBe('TRANSPORT_INVALID_TRANSITION');
  });

  it('candidates only list eligible drivers', async () => {
    const t = await mkTransport();
    const r = await staff('GET', `/transports/${t.id}/candidates`);
    const names = r.data.items.filter((c: J) => c.firstName === 'ZZP').map((c: J) => c.lastName);
    expect(names).not.toContain('Ggg'); // cannot drive
    expect(names).not.toContain('Hhh'); // licence expired
    expect(names).toContain('Zeta');
    await staff('POST', `/transports/${t.id}/cancel`);
  });

  it('assign, modify, forced overlap, volunteer minimal view, refuse, cancel', async () => {
    const t = await mkTransport({ departureTime: '09:00', returnTime: '11:00' });
    const as = await staff('POST', `/transports/${t.id}/assign`, { driverId: ids.a });
    expect(as.status).toBe(200);
    expect(as.data).toMatchObject({ status: 'assegnato', driverId: ids.a });
    expect(mailsTo('a').at(-1)?.subject).toBe('Nuovo impegno assegnato');
    // email content stays minimal (ADR-057)
    const body = mailsTo('a').at(-1)!.text;
    expect(body).not.toMatch(/Roma|Ospedale|visita|nota staff|ZZP|3330000000|3331234567/);

    const t2 = await mkTransport({ departureTime: '10:00', returnTime: '12:00' });
    const ov = await staff('POST', `/transports/${t2.id}/assign`, { driverId: ids.a });
    expect(ov.status).toBe(409);
    expect(ov.data.error.code).toBe('COMMITMENT_OVERLAP');
    await staff('POST', `/transports/${t2.id}/cancel`);

    // volunteer sees only the minimal fields
    const mine = await call('a', 'GET', '/me/commitments');
    expect(mine.status).toBe(200);
    const mt = mine.data.transports.find((x: J) => x.id === t.id);
    expect(Object.keys(mt).sort()).toEqual(
      [
        'id',
        'travelDate',
        'departureTime',
        'appointmentTime',
        'returnTime',
        'fromAddress',
        'toAddress',
        'wheelchair',
        'mobilityAids',
        'companions',
        'status',
        'odometerStart',
        'odometerEnd',
        'km',
        'driverNotes',
        'memberFirstName',
        'memberLastName',
        'contactPhone',
        'vehiclePlate',
        'vehicleModel',
      ].sort(),
    );
    expect(JSON.stringify(mine.data)).not.toMatch(/visita riservata|nota staff riservata/);
    expect((await call('a', 'GET', `/transports/${t.id}`)).status).toBe(403);
    expect((await call('a', 'GET', `/transports/${t.id}/sheet.pdf`)).status).toBe(403);

    // date/time change re-arms: back to assegnato and driver is told
    await call('a', 'POST', `/me/transports/${t.id}/respond`, { accept: true });
    expect((await staff('GET', `/transports/${t.id}`)).data.status).toBe('confermato');
    const mod = await staff('PATCH', `/transports/${t.id}`, { departureTime: '09:30' });
    expect(mod.data.status).toBe('assegnato');
    expect(mailsTo('a').at(-1)?.subject).toBe('Impegno modificato');

    // sheet
    const pdf = await staff('GET', `/transports/${t.id}/sheet.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.res.headers.get('content-type')).toBe('application/pdf');
    expect(
      Buffer.from(await pdf.res.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');

    // refusal frees the transport and tells staff
    const before = sent.length;
    expect(
      (await call('a', 'POST', `/me/transports/${t.id}/respond`, { accept: false })).status,
    ).toBe(204);
    expect(
      sent.slice(before).some((m) => m.to === mail('staff') && m.subject === 'Impegno rifiutato'),
    ).toBe(true);
    expect((await staff('GET', `/transports/${t.id}`)).data).toMatchObject({
      status: 'richiesto',
      driverId: null,
    });
    expect(
      (await call('a', 'POST', `/me/transports/${t.id}/respond`, { accept: false })).status,
    ).toBe(404);

    // assign again, cancel -> driver notified
    await staff('POST', `/transports/${t.id}/assign`, { driverId: ids.b });
    expect((await staff('POST', `/transports/${t.id}/unassign`)).data.status).toBe('richiesto');
    expect(mailsTo('b').at(-1)?.subject).toBe('Impegno annullato');
    expect((await staff('POST', `/transports/${t.id}/unassign`)).data.error.code).toBe(
      'TRANSPORT_INVALID_TRANSITION',
    );
    await staff('POST', `/transports/${t.id}/assign`, { driverId: ids.b });
    await staff('POST', `/transports/${t.id}/cancel`);
    expect(mailsTo('b').at(-1)?.subject).toBe('Impegno annullato');
  });

  it('complete (staff and volunteer) and CSV export', async () => {
    const t = await mkTransport({
      travelDate: today,
      departureTime: '06:00',
      returnTime: '07:00',
      wheelchair: false,
    });
    expect((await staff('POST', `/transports/${t.id}/assign`, { driverId: ids.c })).status).toBe(
      200,
    );
    const done = await staff('POST', `/transports/${t.id}/complete`, {
      odometerStart: 1000,
      odometerEnd: 1012,
      driverNotes: '=SUM(1)',
    });
    expect(done.data).toMatchObject({
      status: 'svolto',
      odometerStart: 1000,
      odometerEnd: 1012,
      km: 12,
    });
    const body = { odometerStart: 1, odometerEnd: 2 };
    expect((await staff('POST', `/transports/${t.id}/complete`, body)).data.error.code).toBe(
      'TRANSPORT_NOT_COMPLETABLE',
    );
    for (const b of [
      { odometerStart: 10, odometerEnd: 9 },
      { odometerStart: 0, odometerEnd: 2001 },
      { odometerStart: -1, odometerEnd: 5 },
      { odometerStart: 1.5, odometerEnd: 5 },
      { odometerStart: 1 },
      { km: 3 },
    ])
      expect((await staff('POST', `/transports/${t.id}/complete`, b)).status).toBe(400);
    const t2 = await mkTransport({
      travelDate: today,
      departureTime: '07:30',
      returnTime: '08:00',
    });
    await staff('POST', `/transports/${t2.id}/assign`, { driverId: ids.c });
    expect(
      (
        await call('c', 'POST', `/me/transports/${t2.id}/complete`, {
          odometerStart: 500,
          odometerEnd: 503,
          driverNotes: 'ok',
        })
      ).status,
    ).toBe(204);
    expect((await staff('GET', `/transports/${t2.id}`)).data).toMatchObject({
      status: 'svolto',
      km: 3,
    });
    expect(
      (
        await call('c', 'POST', `/me/transports/${t2.id}/complete`, {
          odometerStart: 5,
          odometerEnd: 1,
        })
      ).status,
    ).toBe(400);

    const csv = await staff('GET', `/transports/export.csv?month=${today.slice(0, 7)}`);
    expect(csv.status).toBe(200);
    expect(csv.res.headers.get('content-disposition')).toContain(
      `trasporti-${today.slice(0, 7)}.csv`,
    );
    const text = await csv.res.text();
    const lines = text.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe(
      [
        'Data',
        'Partenza',
        'Socio',
        'Da',
        'A',
        'Autista',
        'Targa',
        'Km partenza',
        'Km arrivo',
        'Km',
        'Carrozzina',
        'Ausili',
        'Accompagnatori',
        'Note autista',
      ]
        .map((h) => `"${h}"`)
        .join(';'),
    );
    const row = lines.find((l) => l.includes(`ZZP C${tag}`) && l.includes('06:00'))!;
    expect(row).toContain('"1000";"1012";"12"');
    expect(row).toContain(`"'=SUM(1)"`);
    expect(
      row.startsWith(`"${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}"`),
    ).toBe(true);
    expect((await staff('GET', '/transports/export.csv?month=2026-13')).status).toBe(400);
  });
});

describe('cron', () => {
  const secret = 'cron-secret-for-tests-0123';
  const run = (auth?: string) =>
    app.request('/cron/daily', { headers: auth ? { authorization: auth } : {} });

  it('rejects missing or wrong secret', async () => {
    env.CRON_SECRET = secret;
    expect((await run()).status).toBe(401);
    expect((await run('Bearer nope')).status).toBe(401);
  });

  it('sends one reminder per volunteer and is idempotent', async () => {
    env.CRON_SECRET = secret;
    const s = await mkShift(tomorrow, '16:00', '17:00');
    expect((await assign(s.id, 'f')).status).toBe(201);
    const memId = (await staff('GET', '/members?q=ZZP')).data.items[0].id;
    const t = (
      await staff('POST', '/transports', {
        memberId: memId,
        travelDate: tomorrow,
        departureTime: '07:00',
        fromAddress: 'A',
        toAddress: 'B',
      })
    ).data;
    expect((await staff('POST', `/transports/${t.id}/assign`, { driverId: ids.f })).status).toBe(
      200,
    );

    const before = sent.length;
    const r1 = await run(`Bearer ${secret}`);
    expect(r1.status).toBe(200);
    expect((await r1.json()).sent).toBeGreaterThanOrEqual(1);
    const reminders = sent.slice(before).filter((m) => m.to === mail('f'));
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.text).toContain('16:00');
    expect(reminders[0]!.text).toContain('Trasporto');

    const mid = sent.length;
    const r2 = await run(`Bearer ${secret}`);
    expect(await r2.json()).toMatchObject({ sent: 0, failed: 0 });
    expect(sent).toHaveLength(mid);
  });
});

describe('users invite', () => {
  it('invites a volunteer, rejects duplicates and non-volunteer roles', async () => {
    const body = {
      email: mail('invited'),
      firstName: 'ZZP',
      lastName: 'Nuovo',
      role: 'volontario',
    };
    const r = await staff('POST', '/users/invite', body);
    expect(r.status).toBe(201);
    const [row] =
      await sql`select r.role, v.active from user_roles r join volunteers v on v.id = r.user_id where r.user_id = ${r.data.id}`;
    expect(row).toMatchObject({ role: 'volontario', active: true });
    const audit = await sql`select actor_id, actor_role from audit_log
      where table_name = 'user_roles' and row_id = ${r.data.id}`;
    expect(audit).toEqual([{ actor_id: ids.staff, actor_role: 'staff' }]);
    const dup = await staff('POST', '/users/invite', body);
    expect(dup.status).toBe(409);
    expect(dup.data.error.code).toBe('USER_EXISTS');
    expect(
      (await staff('POST', '/users/invite', { ...body, email: mail('x2'), role: 'staff' })).status,
    ).toBe(403); // staff may not invite staff/super_admin (users.invite_staff, ADR-064)
    expect(
      (await staff('POST', '/users/invite', { ...body, email: 'not-an-email', role: 'x' })).status,
    ).toBe(400);
  });
});
