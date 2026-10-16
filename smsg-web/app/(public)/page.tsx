import type { Metadata } from "next";
import {
  DEFAULT_INTRO,
  DEFAULT_SLOGAN,
  HomeHero,
  HomeQuote,
} from "@/components/public/site-parts";
import { getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: { absolute: "SMS Givolettese — Società di Mutuo Soccorso" },
  alternates: { canonical: "/" },
};

export default async function Home() {
  const site = await getSiteSettings();
  const h = site.pages.home;
  return (
    <div className="space-y-10">
      <HomeHero
        slogan={site.slogan ?? DEFAULT_SLOGAN}
        intro={site.homeIntro ?? DEFAULT_INTRO}
        servicesButton={h.servicesButton}
        whereButton={h.whereButton}
      />
      {h.quote.trim() && <HomeQuote quote={h.quote} source={h.quoteSource} />}
    </div>
  );
}
