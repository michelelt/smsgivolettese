import type { Metadata } from "next";

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

export default function ChiSiamo() {
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
          Oggi questo aiuto prende la forma di servizi sanitari per i soci,
          accompagnamenti, attività culturali e ricreative, e di un luogo dove
          ritrovarsi.
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
    </div>
  );
}
