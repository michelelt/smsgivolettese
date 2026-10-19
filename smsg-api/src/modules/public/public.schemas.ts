import { z } from '@hono/zod-openapi';
import { MediaPath } from '../posts/blocks.js';

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

const t = (max: number) => z.string().trim().min(1).max(max);
const intro = z.string().trim().max(2000);
const simplePage = z.strictObject({ title: t(120), intro });
const section = z.strictObject({ heading: t(120), body: t(5000) });
const longPage = z.strictObject({ title: t(120), intro, sections: z.array(section).max(20) });
const size = z.number().int().positive().max(20000).optional();
// Chi siamo boxes: optional photo and width in fifths of the row (1-5).
const chiSiamoPage = longPage.extend({
  sections: z
    .array(
      section.extend({
        span: z.number().int().min(1).max(5).default(1),
        image: z
          .strictObject({
            path: MediaPath,
            alt: z.string().trim().max(300),
            width: size,
            height: size,
          })
          .optional(),
      }),
    )
    .max(20),
});
export const PageTexts = z
  .strictObject({
    home: z.strictObject({
      servicesButton: t(40),
      whereButton: t(40),
      quote: t(500),
      quoteSource: t(200),
    }),
    chiSiamo: chiSiamoPage,
    privacy: longPage,
    servizi: simplePage,
    convenzioni: simplePage,
    doveSiamo: simplePage,
  })
  .openapi('PageTexts');

export const SiteSettings = z.strictObject({
  address: z.string().nullable(),
  slogan: z.string().nullable(),
  homeIntro: z.string().nullable(),
  vatNumber: z.string().nullable(),
  conventions: z.array(Convention),
  footerLinks: z.array(FooterLink),
  pages: PageTexts,
});
