import { ID, type Role } from './helpers';

export type Min = Role | null | ((r: Role) => boolean); // minimum role, null = nobody, or custom (ownership)
export type Spec = { S?: [Min, string]; I?: [Min, string]; U?: [Min, string]; D?: [Min, string] };

const own: Min = (r) => r === 'volontario' || r === 'super_admin'; // rows owned by the fixture volunteer

export const specs: Record<string, Spec> = {
  profiles: {
    S: ['volontario', 'select 1 from profiles'],
    U: ['staff', `update profiles set phone = '1' where id = '${ID.vol}' returning 1`],
  },
  user_roles: {
    S: ['volontario', 'select 1 from user_roles'],
    I: ['super_admin', `insert into user_roles values ('${ID.noRole}', 'staff') returning 1`],
    U: [
      'super_admin',
      `update user_roles set role = 'staff' where user_id = '${ID.spareUser}' returning 1`,
    ],
    D: ['super_admin', `delete from user_roles where user_id = '${ID.spareUser}' returning 1`],
  },
  volunteers: {
    S: ['volontario', 'select 1 from volunteers'],
    I: ['staff', `insert into volunteers (id) values ('${ID.noRole}') returning 1`],
    U: ['staff', `update volunteers set notes = 'x' where id = '${ID.vol}' returning 1`],
    D: [null, `delete from volunteers where id = '${ID.vol2}' returning 1`],
  },
  vehicles: {
    S: ['staff', 'select 1 from vehicles'],
    I: ['staff', `insert into vehicles (plate, model, seats) values ('NEW1', 'm', 4) returning 1`],
    U: ['staff', `update vehicles set model = 'x' returning 1`],
    D: [
      'staff',
      `delete from vehicles where id = 'f1000000-0000-4000-8000-000000000002' returning 1`,
    ],
  },
  availability_rules: {
    S: ['volontario', 'select 1 from availability_rules'],
    I: [
      own,
      `insert into availability_rules (volunteer_id, weekday, start_time, end_time) values ('${ID.vol}', 2, '08:00', '12:00') returning 1`,
    ],
    U: [
      own,
      `update availability_rules set weekday = 3 where id = 'f2000000-0000-4000-8000-000000000001' returning 1`,
    ],
    D: [
      own,
      `delete from availability_rules where id = 'f2000000-0000-4000-8000-000000000001' returning 1`,
    ],
  },
  availability_exceptions: {
    S: ['volontario', 'select 1 from availability_exceptions'],
    I: [
      own,
      `insert into availability_exceptions (volunteer_id, starts_on, ends_on, kind) values ('${ID.vol}', current_date, current_date, 'assente') returning 1`,
    ],
    U: [
      own,
      `update availability_exceptions set note = 'x' where id = 'f3000000-0000-4000-8000-000000000001' returning 1`,
    ],
    D: [
      own,
      `delete from availability_exceptions where id = 'f3000000-0000-4000-8000-000000000001' returning 1`,
    ],
  },
  shift_types: {
    S: ['volontario', 'select 1 from shift_types'],
    I: ['staff', `insert into shift_types (name) values ('new') returning 1`],
    U: ['staff', `update shift_types set sort_order = 5 returning 1`],
    D: [
      'staff',
      `delete from shift_types where id = 'f4000000-0000-4000-8000-000000000002' returning 1`,
    ],
  },
  shifts: {
    S: ['volontario', 'select 1 from shifts'],
    I: [
      'staff',
      `insert into shifts (shift_type_id, starts_at, ends_at, required_slots) values ('f4000000-0000-4000-8000-000000000001', now() + interval '9 day', now() + interval '9 day 1 hour', 1) returning 1`,
    ],
    U: ['staff', `update shifts set notes = 'x' returning 1`],
    D: [
      'staff',
      `delete from shifts where id = 'f5000000-0000-4000-8000-000000000003' returning 1`,
    ],
  },
  shift_assignments: {
    S: ['volontario', 'select 1 from shift_assignments'],
    I: [
      'staff',
      `insert into shift_assignments (shift_id, volunteer_id) values ('f5000000-0000-4000-8000-000000000003', '${ID.vol}') returning 1`,
    ],
    U: ['staff', `update shift_assignments set status = 'confermato' returning 1`],
    D: [
      'staff',
      `delete from shift_assignments where id = 'f6000000-0000-4000-8000-000000000003' returning 1`,
    ],
  },
  volunteer_commitments: {
    S: ['staff', 'select 1 from volunteer_commitments'],
    I: [
      null,
      `insert into volunteer_commitments (volunteer_id, period, transport_id) values ('${ID.vol}', '[2030-01-01,2030-01-02)', 'fc000000-0000-4000-8000-000000000002') returning 1`,
    ],
    U: [null, `update volunteer_commitments set period = period returning 1`],
    D: [null, `delete from volunteer_commitments returning 1`],
  },
  transports: {
    S: ['staff', 'select 1 from transports'],
    I: [
      'staff',
      `insert into transports (member_id, travel_date, appointment_at) values ('f7000000-0000-4000-8000-000000000001', current_date, now()) returning 1`,
    ],
    U: ['staff', `update transports set notes = 'x' returning 1`],
    D: [null, `delete from transports returning 1`],
  },
  services: {
    S: ['anon', 'select 1 from services'],
    I: ['staff', `insert into services (name) values ('n') returning 1`],
    U: ['staff', `update services set sort_order = 1 returning 1`],
    D: [
      'staff',
      `delete from services where id = 'fa000000-0000-4000-8000-000000000003' returning 1`,
    ],
  },
  members: {
    S: ['staff', 'select 1 from members'],
    I: [
      null,
      `insert into members (card_number, first_name, last_name, joined_on) values (9999, 'a', 'b', current_date) returning 1`,
    ],
    U: ['staff', `update members set notes = 'x' returning 1`],
    D: [null, `delete from members returning 1`],
  },
  membership_fees: {
    S: ['staff', 'select 1 from membership_fees'],
    I: [
      'staff',
      `insert into membership_fees (member_id, year, amount_cents, paid_on, method) values ('f7000000-0000-4000-8000-000000000001', 2023, 1, current_date, 'pos') returning 1`,
    ],
    U: ['staff', `update membership_fees set amount_cents = 5 returning 1`],
    D: [
      'super_admin',
      `delete from membership_fees where id = 'f8000000-0000-4000-8000-000000000002' returning 1`,
    ],
  },
  invoices: {
    S: ['staff', 'select 1 from invoices'],
    I: [
      null,
      `insert into invoices (year, number, issued_on, member_id, customer_name, issuer_name, vat_exemption_text, subtotal_cents, stamp_duty_cents, total_cents, status) values (2021, 1, current_date, 'f7000000-0000-4000-8000-000000000001', 'c', 'i', 'v', 1, 0, 1, 'emessa') returning 1`,
    ],
    U: [
      'staff',
      `update invoices set status = 'pagata', payment_method = 'pos', paid_on = current_date where id = 'fd000000-0000-4000-8000-000000000001' returning 1`,
    ],
    D: [null, `delete from invoices returning 1`],
  },
  invoice_lines: {
    S: ['staff', 'select 1 from invoice_lines'],
    I: [
      null,
      `insert into invoice_lines (invoice_id, position, description, amount_cents) values ('fd000000-0000-4000-8000-000000000001', 2, 'd', 1) returning 1`,
    ],
    U: [null, `update invoice_lines set description = 'x' returning 1`],
    D: [null, `delete from invoice_lines returning 1`],
  },
  invoice_counters: {
    S: ['staff', 'select 1 from invoice_counters'],
    I: [null, `insert into invoice_counters (year) values (2021) returning 1`],
    U: [null, `update invoice_counters set last_number = 50 returning 1`],
    D: [null, `delete from invoice_counters returning 1`],
  },
  posts: {
    S: ['anon', 'select 1 from posts'],
    I: [
      'staff',
      `insert into posts (slug, title, category) values ('t-new', 't', 'avviso') returning 1`,
    ],
    U: ['staff', `update posts set title = 'x' returning 1`],
    D: ['staff', `delete from posts where id = 'ff000000-0000-4000-8000-000000000003' returning 1`],
  },
  post_proposals: {
    S: ['staff', 'select 1 from post_proposals'],
    I: [
      null,
      `insert into post_proposals (title, category, body, submitter_name) values ('t', 'avviso', 'b', 'n') returning 1`,
    ],
    U: ['staff', `update post_proposals set status = 'rifiutata' returning 1`],
    D: [
      'super_admin',
      `delete from post_proposals where id = 'ff100000-0000-4000-8000-000000000002' returning 1`,
    ],
  },
  media: {
    S: ['anon', 'select 1 from media'],
    I: [
      'staff',
      `insert into media (bucket, path, mime, size_bytes) values ('media', 'n/x.png', 'image/png', 1) returning 1`,
    ],
    U: [null, `update media set alt = 'x' returning 1`],
    D: ['staff', `delete from media where id = 'fe000000-0000-4000-8000-000000000003' returning 1`],
  },
  site_settings: {
    S: ['anon', 'select 1 from site_settings'],
    I: [null, `insert into site_settings (id) values (false) returning 1`],
    U: ['staff', `update site_settings set slogan = 'x' returning 1`],
    D: [null, `delete from site_settings returning 1`],
  },
  org_settings: {
    S: ['staff', 'select 1 from org_settings'],
    I: [null, `insert into org_settings (id) values (false) returning 1`],
    U: ['staff', `update org_settings set membership_fee_cents = 2500 returning 1`],
    D: [null, `delete from org_settings returning 1`],
  },
  audit_log: {
    S: ['super_admin', 'select 1 from audit_log'],
    I: [null, `insert into audit_log (action, table_name) values ('insert', 'x') returning 1`],
    U: [null, `update audit_log set redacted = true returning 1`],
    D: [null, `delete from audit_log returning 1`],
  },
  rate_limit_hits: {
    S: [null, 'select 1 from rate_limit_hits'],
    I: [null, `insert into rate_limit_hits values ('k', now(), 1) returning 1`],
    U: [null, `update rate_limit_hits set hits = 2 returning 1`],
    D: [null, `delete from rate_limit_hits returning 1`],
  },
};
