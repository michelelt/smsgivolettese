import { z } from '@hono/zod-openapi';

const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

export const Service = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  scheduleNote: z.string().nullable(),
});
export const ServicesResponse = z.strictObject({ items: z.array(Service) });

export const Convention = z.strictObject({
  title: z.string(),
  description: z.string(),
  url: httpsUrl.optional(),
});
export const FooterLink = z.strictObject({
  group: z.enum(['associazioni', 'mutuo_soccorso', 'utili']),
  label: z.string(),
  url: httpsUrl,
});

export const SiteSettings = z.strictObject({
  address: z.string().nullable(),
  slogan: z.string().nullable(),
  homeIntro: z.string().nullable(),
  vatNumber: z.string().nullable(),
  conventions: z.array(Convention),
  footerLinks: z.array(FooterLink),
});
