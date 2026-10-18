import type { z } from '@hono/zod-openapi';
import type { Tx } from '../../lib/db.js';
import type { CountersInput, OrgSettings, OrgSettingsInput } from './org-settings.schemas.js';

export const get = async (tx: Tx, year: number) =>
  (
    await tx<OrgSettings[]>`
      select o.legal_name as "legalName", o.tax_code as "taxCode", o.address,
             o.vat_exemption_text as "vatExemptionText",
             o.stamp_duty_threshold_cents as "stampDutyThresholdCents",
             o.stamp_duty_amount_cents as "stampDutyAmountCents",
             o.membership_fee_cents as "membershipFeeCents", o.km_rate_cents as "kmRateCents",
             o.video_max_mb as "videoMaxMb",
             o.last_card_number as "lastCardNumber",
             json_build_object('year', ${year}::int,
               'lastNumber', coalesce((select last_number from public.invoice_counters where year = ${year}), 0)
             ) as "invoiceCounter"
      from public.org_settings o`
  )[0]!;

// last_card_number is deliberately not touched here (counters have their own permission).
export const update = (tx: Tx, s: z.infer<typeof OrgSettingsInput>) =>
  tx`update public.org_settings set legal_name = ${s.legalName}, tax_code = ${s.taxCode},
       address = ${s.address}, vat_exemption_text = ${s.vatExemptionText},
       stamp_duty_threshold_cents = ${s.stampDutyThresholdCents},
       stamp_duty_amount_cents = ${s.stampDutyAmountCents},
       membership_fee_cents = ${s.membershipFeeCents}, km_rate_cents = ${s.kmRateCents},
       video_max_mb = ${s.videoMaxMb},
       updated_at = now()`;

export async function setCounters(tx: Tx, c: CountersInput) {
  if (c.lastCardNumber !== undefined) await tx`select app.set_member_counter(${c.lastCardNumber})`;
  if (c.invoiceYear !== undefined)
    await tx`select app.set_invoice_counter(${c.invoiceYear}::smallint, ${c.invoiceLastNumber!})`;
}
