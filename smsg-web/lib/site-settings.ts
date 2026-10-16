import { z } from "zod";
import { isHttps } from "@/lib/public/https-url";

// Mirrors the API limits (ADR-051): https-only links, bounded lengths.
export const httpsUrl = z
  .string()
  .trim()
  .regex(/^https:\/\/\S+$/, "scriva un indirizzo che inizia con https://")
  .refine(isHttps, "scriva un indirizzo che inizia con https://");

export const conventionSchema = z.object({
  title: z.string().trim().min(1, "scriva il titolo").max(200),
  description: z.string().trim().min(1, "scriva la descrizione").max(1000),
  url: z.union([z.literal(""), httpsUrl]),
});
export const linkSchema = z.object({
  group: z.enum(["associazioni", "mutuo_soccorso", "utili"]),
  label: z.string().trim().min(1, "scriva il testo del link").max(100),
  url: httpsUrl,
});
export const siteSchema = z.object({
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
