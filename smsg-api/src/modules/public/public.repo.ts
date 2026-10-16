import { db } from '../../lib/db.js';
import type { z } from '@hono/zod-openapi';
import type { BookingInput, Service, SiteSettings } from './public.schemas.js';

export const listServices = (requestId?: string) =>
  db.asAnon(
    (tx) => tx<z.infer<typeof Service>[]>`
      select id, name, description, member_price_cents as "memberPriceCents",
             non_member_price_cents as "nonMemberPriceCents", schedule_note as "scheduleNote",
             bookable, requires_transport as "requiresTransport"
      from public.services where active order by sort_order, name`,
    requestId,
  );

export const getSiteSettings = async (requestId?: string) =>
  (
    await db.asAnon(
      (tx) => tx<z.infer<typeof SiteSettings>[]>`
        select phone, email, address, opening_hours as "openingHours", slogan,
               home_intro as "homeIntro", membership_info as "membershipInfo"
        from public.site_settings`,
      requestId,
    )
  )[0]!;

export const consumeRateLimit = async (key: string, max: number, windowSeconds: number) =>
  (
    await db.asService(
      (tx) => tx`select app.consume_rate_limit(${key}, ${max}, ${windowSeconds}) as ok`,
    )
  )[0]!.ok as boolean;

export const submitBooking = async (b: BookingInput, requestId?: string) =>
  (
    await db.asAnon(
      (tx) => tx`
        select public.submit_public_booking(${b.firstName}, ${b.lastName}, ${b.phone}, ${b.serviceId},
          ${b.day}, ${b.slot}, ${b.declaredMember}, ${b.notes ?? null}) as id`,
      requestId,
    )
  )[0]!.id as string;
