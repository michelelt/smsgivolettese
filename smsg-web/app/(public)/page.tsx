import type { Metadata } from "next";
import { ServiceCard } from "@/components/public/service-card";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getServices, getSiteSettings, telHref } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: { absolute: "SMS Givolettese — Società di Mutuo Soccorso" },
  alternates: { canonical: "/" },
};

const STEPS = [
  [
    "Scelga il servizio",
    "Visita, prelievo, accompagnamento: tutto è elencato con il prezzo.",
  ],
  [
    "Scelga il giorno",
    "Tocchi la data che preferisce, di mattina o di pomeriggio.",
  ],
  [
    "Lasci nome e telefono",
    "La richiamiamo noi per confermare l'orario preciso.",
  ],
];

export default async function Home() {
  const [site, services] = await Promise.all([
    getSiteSettings(),
    getServices(),
  ]);
  return (
    <div className="space-y-10">
      <section className="space-y-4 rounded-2xl bg-blu p-6 text-white">
        <h1 className="text-4xl font-extrabold">
          {site.slogan ?? "Ci aiutiamo a vicenda, qui a Givoletto."}
        </h1>
        <p className="text-xl">
          {site.homeIntro ??
            "Visite, prelievi, accompagnamenti e momenti insieme per i soci e le loro famiglie. Prenotare è semplice: bastano pochi tocchi oppure una telefonata."}
        </p>
        <ButtonLink href="/prenota" variant="secondary">
          <Icon name="cal" />
          Prenota una prestazione
        </ButtonLink>
      </section>

      {site.phone && (
        <section className="rounded-2xl border-2 border-bordeaux p-5">
          <p>
            <b>Preferisce parlare con una persona?</b> Ci chiami: prenotiamo noi
            per Lei.
          </p>
          <p className="mt-2 text-3xl font-extrabold">
            <a href={telHref(site.phone)} className="text-bordeaux underline">
              {site.phone}
            </a>
          </p>
          {site.openingHours && (
            <p className="mt-2 whitespace-pre-line">{site.openingHours}</p>
          )}
        </section>
      )}

      <section aria-labelledby="tre-passi" className="space-y-4">
        <h2 id="tre-passi" className="text-3xl font-extrabold text-bordeaux">
          Prenotare in tre passi
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span
                aria-hidden="true"
                className="grid size-11 flex-none place-items-center rounded-full bg-bordeaux text-xl font-extrabold text-white"
              >
                {i + 1}
              </span>
              <div>
                <b>
                  <span className="sr-only">Passo {i + 1}: </span>
                  {t}
                </b>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="servizi" className="space-y-4">
        <h2 id="servizi" className="text-3xl font-extrabold text-bordeaux">
          I nostri servizi
        </h2>
        {services.length === 0 ? (
          <p>
            Al momento non ci sono servizi da mostrare.
            {site.phone && " Ci telefoni per informazioni."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.slice(0, 4).map((s) => (
              <ServiceCard key={s.id} s={s} />
            ))}
          </div>
        )}
        <ButtonLink href="/servizi" variant="secondary">
          Tutti i servizi e i prezzi
        </ButtonLink>
      </section>

      <blockquote className="border-l-8 border-bordeaux pl-4 italic">
        Le Società di Mutuo Soccorso non hanno finalità di lucro, ma perseguono
        finalità di interesse generale, sulla base del principio costituzionale
        di sussidiarietà.
        <footer className="mt-1 text-base not-italic">
          Legge 15 aprile 1886, n. 3818, articolo 1
        </footer>
      </blockquote>
    </div>
  );
}
