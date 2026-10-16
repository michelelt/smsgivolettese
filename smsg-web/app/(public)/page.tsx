import type { Metadata } from "next";
import {
  DEFAULT_INTRO,
  DEFAULT_SLOGAN,
  HomeHero,
} from "@/components/public/site-parts";
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
      <HomeHero
        slogan={site.slogan ?? DEFAULT_SLOGAN}
        intro={site.homeIntro ?? DEFAULT_INTRO}
      />

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
