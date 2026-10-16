import { z } from "zod";

const email = z.email("Scrivi un indirizzo email valido.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Scrivi la password."),
});

export const magicLinkSchema = z.object({ email });

export const setPasswordSchema = z
  .object({
    password: z.string().min(10, "La password deve avere almeno 10 caratteri."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Le due password non sono uguali.",
  });
