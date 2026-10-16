import { z } from '@hono/zod-openapi';
import { Convention, FooterLink, PageTexts, SiteSettings } from '../public/public.schemas.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

export const SiteSettingsInput = z
  .strictObject({
    address: z.string().trim().max(200).nullable(),
    slogan: z.string().trim().max(200).nullable(),
    homeIntro: z.string().trim().max(2000).nullable(),
    vatNumber: z
      .string()
      .regex(/^\d{11}$/, 'La partita IVA ha 11 cifre')
      .nullable(),
    conventions: z
      .array(
        Convention.extend({
          title: text(120),
          description: z.string().trim().max(500),
          url: httpsUrl.optional(),
        }),
      )
      .max(50),
    footerLinks: z.array(FooterLink.extend({ label: text(120), url: httpsUrl })).max(60),
    pages: PageTexts,
  })
  .openapi('SiteSettingsInput');

export { SiteSettings };

export const OrgInfo = z
  .strictObject({
    legalName: z.string(),
    taxCode: z.string().nullable(),
    address: z.string().nullable(),
    membershipFeeCents: z.number().int(),
    stampDutyThresholdCents: z.number().int(),
    stampDutyAmountCents: z.number().int(),
    nextCardNumber: z.number().int(),
  })
  .openapi('OrgInfo');
export type OrgInfo = z.infer<typeof OrgInfo>;
