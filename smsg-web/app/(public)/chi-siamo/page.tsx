import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Chi siamo",
  description:
    "Una società di persone che si aiutano: la storia e i valori della SMS Givolettese.",
  alternates: { canonical: "/chi-siamo" },
};

const VALUES = [
  [
    "Senza scopo di lucro",
    "Ogni euro raccolto torna ai soci sotto forma di servizi e sostegno.",
  ],
  [
    "Porta aperta",
    "Chiunque può iscriversi. Una volta soci, non si viene esclusi per età o per salute.",
  ],
  [
    "Decidono i soci",
    "L'assemblea dei soci elegge il consiglio e approva il bilancio ogni anno.",
  ],
];

export default async function ChiSiamo() {
  const site = await getSiteSettings();
  return (
    <div className="space-y-8">
      <div className="max-w-prose space-y-4">
        <h1 className="text-4xl font-extrabold text-bordeaux">
          Una società di persone che si aiutano
        </h1>
        <p>
          La Società di Mutuo Soccorso Givolettese fa parte di una lunga
          tradizione piemontese: lavoratori e famiglie che, versando una piccola
          quota, si sostengono a vicenda nei momenti di bisogno.
        </p>
        <p>
          Oggi questo aiuto prende la forma di servizi sanitari a prezzi
          agevolati, accompagnamenti, attività culturali e ricreative, e di un
          luogo dove ritrovarsi.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {VALUES.map(([t, d]) => (
          <section
            key={t}
            className="rounded-2xl border-2 border-ink bg-white p-5"
          >
            <h2 className="text-2xl font-extrabold">{t}</h2>
            <p className="mt-2">{d}</p>
          </section>
        ))}
      </div>
      <section className="space-y-3 rounded-2xl border-2 border-blu p-5">
        <h2 className="text-3xl font-extrabold text-blu">Diventare socio</h2>
        <p className="whitespace-pre-line">
          {site.membershipInfo ??
            "Passi in sede durante gli orari di apertura con un documento d'identità e il codice fiscale."}
        </p>
        <ButtonLink href="/contatti">
          <Icon name="pin" />
          Dove siamo e orari
        </ButtonLink>
      </section>
    </div>
  );
}
