import { redirect } from "next/navigation";
import { hasRole, SECTIONS } from "@/lib/auth/roles";
import { Providers } from "./providers";
import { GestioneNav, type NavGroup } from "./staff-nav";
import { getSessionRole } from "@/lib/supabase/server";

type Item = NavGroup["items"][number];
/** Order of groups and of the links inside them, with the one-line help shown in the menus. */
const MENU: Record<string, Record<string, Pick<Item, "icon" | "desc">>> = {
  Attività: {
    prenotazioni: { icon: "cal", desc: "Richieste e appuntamenti" },
    turni: { icon: "clock", desc: "Turni della settimana" },
    trasporti: { icon: "car", desc: "Viaggi e accompagnamenti" },
    disponibilita: { icon: "hands", desc: "Chi può aiutare e quando" },
  },
  Persone: {
    soci: { icon: "heart", desc: "Iscrizioni e quote" },
    volontari: { icon: "hands", desc: "Elenco dei volontari" },
  },
  Amministrazione: {
    fatture: { icon: "doc", desc: "Fatture e pagamenti" },
    servizi: { icon: "tag", desc: "Elenco servizi e tariffe" },
    mezzi: { icon: "car", desc: "Veicoli dell’associazione" },
  },
  Sito: {
    bacheca: { icon: "news", desc: "Avvisi per i soci" },
    sito: { icon: "globe", desc: "Testi di tutte le pagine" },
  },
  "Super admin": {
    impostazioni: { icon: "gear", desc: "Configurazione generale" },
    "utenti-e-ruoli": { icon: "shield", desc: "Account e permessi" },
    "registro-attivita": { icon: "list", desc: "Chi ha fatto cosa" },
  },
};
const ROLE_LABEL = {
  volontario: "Volontario",
  staff: "Staff",
  super_admin: "Super admin",
} as const;

export default async function GestioneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = await getSessionRole();
  if (!role) redirect("/accedi?next=/gestione"); // defence in depth behind proxy.ts
  const groups: NavGroup[] = Object.entries(MENU)
    .map(([name, slugs]) => ({
      name,
      items: Object.entries(slugs).flatMap(([slug, m]) => {
        const s = SECTIONS.find((x) => x.slug === slug);
        if (!s || s.group !== name || !hasRole(role, s.min)) return [];
        const label =
          slug === "disponibilita" ? "Disponibilità volontari" : s.label;
        return [{ href: `/gestione/${slug}`, label, ...m }];
      }),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <>
      <GestioneNav
        groups={groups}
        roleLabel={ROLE_LABEL[role]}
        volunteer={role === "volontario"}
      />
      <div className="mx-auto max-w-[1800px] px-4 md:px-6 lg:px-8 py-6">
        <main>
          <Providers>{children}</Providers>
        </main>
      </div>
    </>
  );
}
