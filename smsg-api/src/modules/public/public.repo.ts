import { db } from '../../lib/db.js';
import type { z } from '@hono/zod-openapi';
import type { Service, SiteSettings } from './public.schemas.js';

export const listServices = (requestId?: string) =>
  db.asAnon(
    (tx) => tx<z.infer<typeof Service>[]>`
      select id, name, description, schedule_note as "scheduleNote"
      from public.services where active order by sort_order, name`,
    requestId,
  );

export const getSiteSettings = async (requestId?: string) =>
  (
    await db.asAnon(
      (tx) => tx<z.infer<typeof SiteSettings>[]>`
        select address, slogan, home_intro as "homeIntro", vat_number as "vatNumber",
               conventions, footer_links as "footerLinks", pages
        from public.site_settings`,
      requestId,
    )
  )[0]!;

// used by phase 6 proposals
export const consumeRateLimit = async (key: string, max: number, windowSeconds: number) =>
  (
    await db.asService(
      (tx) => tx`select app.consume_rate_limit(${key}, ${max}, ${windowSeconds}) as ok`,
    )
  )[0]!.ok as boolean;
