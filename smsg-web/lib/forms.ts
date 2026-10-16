import { z } from "zod";

const norm = (s: string) => s.replace(/\s/g, "").toUpperCase();

/** Hard rule only (= DB check); the official layout is checked by the API (ADR-048). */
export const taxCodeField = z
  .string()
  .refine(
    (v) => v.trim() === "" || /^[A-Z0-9]{16}$/.test(norm(v)),
    "il codice fiscale ha 16 tra lettere e numeri",
  );

export const optText = (max: number) =>
  z.string().max(max, `al massimo ${max} caratteri`);

export const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

export const dateField = z
  .string()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "data non valida");

export const METHODS = [
  ["contanti", "Contanti"],
  ["pos", "Carta"],
  ["bonifico", "Bonifico"],
] as const;
