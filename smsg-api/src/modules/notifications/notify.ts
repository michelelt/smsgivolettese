import { sendEmail, type Email } from '../../lib/email.js';
import type { Tx } from '../../lib/db.js';
import * as t from './templates.js';
import type { Item } from './templates.js';

export type Mail = Email;
export type Kind = 'assigned' | 'modified' | 'cancelled';

/** Sends one by one after commit; sendEmail never throws, so a failure never fails the request. */
export const dispatch = async (mails: Mail[]) => {
  for (const m of mails) await sendEmail(m);
};

/** Email of an active volunteer (staff and the caller's own row are readable under RLS). */
export const volunteerMail = async (
  tx: Tx,
  volunteerId: string,
  kind: Kind,
  item: Item,
): Promise<Mail[]> => {
  const [p] = await tx<{ email: string }[]>`
    select email from public.profiles where id = ${volunteerId} and active`;
  return p ? [{ to: p.email, ...t[kind](item) }] : [];
};

/** Volunteers cannot read other profiles: caller passes a service-role tx. */
export const staffRefusalMails = async (
  tx: Tx,
  volunteerId: string,
  item: Item,
): Promise<Mail[]> => {
  const [v] = await tx<{ name: string }[]>`
    select first_name || ' ' || last_name as name from public.profiles where id = ${volunteerId}`;
  const staff = await tx<{ email: string }[]>`
    select p.email from public.profiles p join public.user_roles r on r.user_id = p.id
    where p.active and r.role in ('staff', 'super_admin')`;
  return staff.map((s) => ({ to: s.email, ...t.refused(v?.name ?? 'Un volontario', item) }));
};

/** Shift or transport as an email Item; times in Europe/Rome. */
export const shiftItem = async (tx: Tx, shiftId: string) =>
  (
    await tx<Item[]>`
      select st.name as label, (s.starts_at at time zone 'Europe/Rome')::date::text as day,
             to_char(s.starts_at at time zone 'Europe/Rome', 'HH24:MI') || '–' ||
             to_char(s.ends_at at time zone 'Europe/Rome', 'HH24:MI') as time
      from public.shifts s join public.shift_types st on st.id = s.shift_type_id where s.id = ${shiftId}`
  )[0];
export const transportItem = async (tx: Tx, id: string) =>
  (
    await tx<Item[]>`
      select 'Trasporto' as label, travel_date::text as day,
             to_char(departure_at at time zone 'Europe/Rome', 'HH24:MI') as time
      from public.transports where id = ${id}`
  )[0];
