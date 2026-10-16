import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: { absolute: "SMS Givolettese — Società di Mutuo Soccorso" },
  alternates: { canonical: "/" },
};

export default async function Home() {
  const site = await getSiteSettings();
  return (
    <div className="space-y-10">
      <section className="space-y-4 rounded-2xl bg-blu p-6 text-white">
        <h1 className="text-4xl font-extrabold">
          {site.slogan ?? "Ci aiutiamo a vicenda, qui a Givoletto."}
        </h1>
        <p className="text-xl">
          {site.homeIntro ??
            "Servizi, convenzioni e momenti insieme per i soci e le loro famiglie."}
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/servizi" variant="secondary">
            <Icon name="heart" />I nostri servizi
          </ButtonLink>
          <ButtonLink href="/dove-siamo" variant="secondary">
            <Icon name="pin" />
            Dove siamo
          </ButtonLink>
        </div>
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
