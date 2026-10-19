import { z } from "zod";
import { isHttps } from "@/lib/public/https-url";

// Mirrors the API limits (ADR-051): https-only links, bounded lengths.
export const httpsUrl = z
  .string()
  .trim()
  .regex(/^https:\/\/\S+$/, "scrivi un indirizzo che inizia con https://")
  .refine(isHttps, "scrivi un indirizzo che inizia con https://");

export const conventionSchema = z.object({
  title: z.string().trim().min(1, "scrivi il titolo").max(200),
  description: z.string().trim().min(1, "scrivi la descrizione").max(1000),
  url: z.union([z.literal(""), httpsUrl]),
});
export const linkSchema = z.object({
  group: z.enum(["associazioni", "mutuo_soccorso", "utili"]),
  label: z.string().trim().min(1, "scrivi il testo del link").max(100),
  url: httpsUrl,
});
const title = z.string().trim().min(1, "scrivi il titolo").max(120);
const intro = z.string().trim().max(2000, "al massimo 2000 caratteri");
const sections = z
  .array(
    z.object({
      heading: title,
      body: z.string().trim().min(1, "scrivi il testo").max(5000),
    }),
  )
  .max(20);
export const pagesSchema = z.object({
  home: z.object({
    servicesButton: z.string().trim().min(1, "scrivi il testo").max(40),
    whereButton: z.string().trim().min(1, "scrivi il testo").max(40),
    quote: z.string().trim().min(1, "scrivi la citazione").max(500),
    quoteSource: z.string().trim().min(1, "scrivi la fonte").max(200),
  }),
  chiSiamo: z.object({ title, intro, sections }),
  privacy: z.object({ title, intro, sections }),
  servizi: z.object({ title, intro }),
  convenzioni: z.object({ title, intro }),
  doveSiamo: z.object({ title, intro }),
});
export type PagesValues = z.infer<typeof pagesSchema>;
export const serviceTextSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "scrivi il nome").max(120),
  description: z.string().max(1000, "al massimo 1000 caratteri"),
  scheduleNote: z.string().max(200, "al massimo 200 caratteri"),
});
export type ServiceTexts = z.infer<typeof serviceTextSchema>;

export const siteSchema = z.object({
  pages: pagesSchema,
  services: z.array(serviceTextSchema),
  address: z.string().max(200, "al massimo 200 caratteri"),
  slogan: z.string().max(200, "al massimo 200 caratteri"),
  homeIntro: z.string().max(2000, "al massimo 2000 caratteri"),
  vatNumber: z
    .string()
    .refine(
      (v) => v === "" || /^\d{11}$/.test(v.trim()),
      "la partita IVA ha 11 cifre",
    ),
  conventions: z.array(conventionSchema).max(50),
  footerLinks: z.array(linkSchema).max(60),
});
export type SiteValues = z.infer<typeof siteSchema>;
export type ConventionValues = z.infer<typeof conventionSchema>;
export type LinkValues = z.infer<typeof linkSchema>;
