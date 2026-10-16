import type { z } from '@hono/zod-openapi';
import type { Tx } from '../../lib/db.js';
import type { OrgInfo, SiteSettings, SiteSettingsInput } from './settings.schemas.js';

export const putSiteSettings = async (tx: Tx, s: z.infer<typeof SiteSettingsInput>) =>
  (
    await tx<z.infer<typeof SiteSettings>[]>`
      update public.site_settings set address = ${s.address}, slogan = ${s.slogan},
        home_intro = ${s.homeIntro}, vat_number = ${s.vatNumber},
        conventions = ${tx.json(s.conventions)}, footer_links = ${tx.json(s.footerLinks)},
        updated_at = now()
      returning address, slogan, home_intro as "homeIntro", vat_number as "vatNumber",
                conventions, footer_links as "footerLinks"`
  )[0]!;

export const orgInfo = async (tx: Tx) =>
  (
    await tx<OrgInfo[]>`
      select legal_name as "legalName", tax_code as "taxCode", address,
             membership_fee_cents as "membershipFeeCents",
             stamp_duty_threshold_cents as "stampDutyThresholdCents",
             stamp_duty_amount_cents as "stampDutyAmountCents", next_card_number as "nextCardNumber"
      from public.staff_org_info()`
  )[0]!;
