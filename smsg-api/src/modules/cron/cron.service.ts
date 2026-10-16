import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { db } from '../../lib/db.js';
import { sendEmail } from '../../lib/email.js';
import { reminder } from '../notifications/templates.js';
import type { Item } from '../notifications/templates.js';

const R = 'Europe/Rome';
const digest = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time check of `Authorization: Bearer ${CRON_SECRET}`. */
export const validSecret = (header: string | undefined) => {
  const m = /^Bearer (.+)$/.exec(header ?? '');
  return !!env.CRON_SECRET && !!m && timingSafeEqual(digest(m[1]!), digest(env.CRON_SECRET));
};

type Row = Item & {
  volunteerId: string;
  email: string;
  kind: 'shift' | 'transport';
  id: string;
  date: string;
};

/**
 * ADR-058: one reminder per volunteer for tomorrow (Rome). `reminder_sent_at` is set only after
 * a successful send and only on rows still unset, so a second run sends nothing.
 */
export async function daily(requestId?: string) {
  const rows = await db.asService(
    (tx) => tx<Row[]>`
      with d as (select ((now() at time zone ${R})::date + 1) as day)
      select a.volunteer_id as "volunteerId", p.email, 'shift' as kind, a.id, st.name as label,
             d.day::text as date, d.day::text as day,
             to_char(s.starts_at at time zone ${R}, 'HH24:MI') || '–' || to_char(s.ends_at at time zone ${R}, 'HH24:MI') as time
      from d, public.shift_assignments a
      join public.shifts s on s.id = a.shift_id
      join public.shift_types st on st.id = s.shift_type_id
      join public.profiles p on p.id = a.volunteer_id and p.active
      where a.status in ('proposto', 'confermato') and a.reminder_sent_at is null
        and (s.starts_at at time zone ${R})::date = d.day
      union all
      select t.driver_volunteer_id, p.email, 'transport', t.id, 'Trasporto', d.day::text, t.travel_date::text,
             to_char(t.departure_at at time zone ${R}, 'HH24:MI')
      from d, public.transports t
      join public.profiles p on p.id = t.driver_volunteer_id and p.active
      where t.status in ('assegnato', 'confermato') and t.reminder_sent_at is null and t.travel_date = d.day
      order by 1, 8`,
    requestId,
  );
  const byVolunteer = new Map<string, Row[]>();
  for (const r of rows)
    byVolunteer.set(r.volunteerId, [...(byVolunteer.get(r.volunteerId) ?? []), r]);
  let sent = 0;
  let failed = 0;
  for (const [volunteerId, items] of byVolunteer) {
    const first = items[0]!;
    const ok = await sendEmail({
      to: first.email,
      ...reminder(items),
      idempotencyKey: `reminder:${volunteerId}:${first.date}`,
    });
    if (!ok) {
      failed++;
      continue;
    }
    sent++;
    const ids = (k: Row['kind']) => items.filter((i) => i.kind === k).map((i) => i.id);
    await db.asService(async (tx) => {
      if (ids('shift').length)
        await tx`update public.shift_assignments set reminder_sent_at = now()
                 where id in ${tx(ids('shift'))} and reminder_sent_at is null`;
      if (ids('transport').length)
        await tx`update public.transports set reminder_sent_at = now()
                 where id in ${tx(ids('transport'))} and reminder_sent_at is null`;
    }, requestId);
  }
  return { sent, failed };
}
