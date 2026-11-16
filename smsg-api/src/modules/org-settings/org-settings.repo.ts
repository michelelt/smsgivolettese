import type { z } from '@hono/zod-openapi';
import type { Tx } from '../../lib/db.js';
import type { CountersInput, OrgSettings, OrgSettingsInput } from './org-settings.schemas.js';

export const get = async (tx: Tx) =>
  (
    await tx<OrgSettings[]>`
      select o.legal_name as "legalName", o.tax_code as "taxCode", o.address,
             o.membership_fee_cents as "membershipFeeCents", o.price_bands as "priceBands",
             o.video_max_mb as "videoMaxMb",
             o.last_card_number as "lastCardNumber"
      from public.org_settings o`
  )[0]!;

// last_card_number is deliberately not touched here (counters have their own permission).
export const update = (tx: Tx, s: z.infer<typeof OrgSettingsInput>) =>
  tx`update public.org_settings set legal_name = ${s.legalName}, tax_code = ${s.taxCode},
       address = ${s.address},
       membership_fee_cents = ${s.membershipFeeCents}, price_bands = ${tx.json(s.priceBands)},
       video_max_mb = ${s.videoMaxMb},
       updated_at = now()`;

export const setCounters = (tx: Tx, c: CountersInput) =>
  tx`select app.set_member_counter(${c.lastCardNumber})`;
