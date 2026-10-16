import { z } from "zod";

export const appRoleSchema = z.enum(["volontario", "staff", "super_admin"]);
export type AppRole = z.infer<typeof appRoleSchema>;

const RANK: Record<AppRole, number> = {
  volontario: 1,
  staff: 2,
  super_admin: 3,
};

/** Reads the `app_role` claim; anything unknown counts as no role. */
export const roleFromClaims = (claims: unknown): AppRole | null => {
  const r = appRoleSchema.safeParse(
    (claims as { app_role?: unknown } | null)?.app_role,
  );
  return r.success ? r.data : null;
};

/** Section under /gestione -> label and minimum role (mirrors docs/permissions.md). */
export const SECTIONS = [
  { slug: "disponibilita", label: "Le mie disponibilità", min: "volontario" },
  { slug: "prenotazioni", label: "Prenotazioni", min: "staff" },
  { slug: "utenti", label: "Utenti", min: "staff" },
  { slug: "soci", label: "Soci", min: "staff" },
  { slug: "fatture", label: "Fatture", min: "staff" },
  { slug: "bacheca", label: "Bacheca", min: "staff" },
  { slug: "servizi", label: "Servizi", min: "staff" },
  { slug: "turni", label: "Turni", min: "staff" },
  { slug: "trasporti", label: "Trasporti", min: "staff" },
  { slug: "volontari", label: "Volontari", min: "staff" },
  { slug: "impostazioni", label: "Impostazioni", min: "super_admin" },
  { slug: "utenti-e-ruoli", label: "Utenti e ruoli", min: "super_admin" },
  { slug: "registro-attivita", label: "Registro attività", min: "super_admin" },
] as const satisfies readonly { slug: string; label: string; min: AppRole }[];

export const hasRole = (role: AppRole | null, min: AppRole) =>
  role !== null && RANK[role] >= RANK[min];

/** Can this role open `pathname`? Only meaningful for /gestione paths. */
export function canAccess(role: AppRole | null, pathname: string): boolean {
  if (pathname !== "/gestione" && !pathname.startsWith("/gestione/"))
    return true;
  if (role === null) return false;
  const slug = pathname.split("/")[2];
  if (!slug || slug === "account") return true; // dashboard and own account: any role
  const section = SECTIONS.find((s) => s.slug === slug);
  // Unknown sections: super_admin only, so new pages are closed by default.
  return hasRole(role, section?.min ?? "super_admin");
}

/** Open-redirect guard for `next` params. */
export function safeNext(next: string | null | undefined): string {
  const bad = /[\\\s\u0000-\u001f\u007f]/; // backslash, whitespace, control chars
  try {
    // Check the decoded form too: `/%09/evil.com` becomes `//evil.com` in browsers.
    if (!next || bad.test(next) || bad.test(decodeURIComponent(next)))
      return "/gestione";
    const dec = decodeURIComponent(next);
    const u = new URL(next, "http://x.invalid");
    if (
      u.origin !== "http://x.invalid" ||
      !next.startsWith("/") ||
      dec.startsWith("//")
    )
      return "/gestione";
    return next;
  } catch {
    return "/gestione";
  }
}
