import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { HomeNews } from "@/components/posts/home-sections";
import { AddressMap } from "@/components/public/address-map";
import { ServiceCard } from "@/components/public/service-card";
import {
  ConventionCard,
  DEFAULT_SLOGAN,
  HomeHero,
  HomeQuote,
} from "@/components/public/site-parts";
import { Icon } from "@/components/ui/icon";
import { getServices, getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: { absolute: "SMS Givolettese — Società di Mutuo Soccorso" },
  alternates: { canonical: "/" },
};

// One page to scroll: each band holds one topic, kept short; the full text stays on its own page.
const MAX_CONVENTIONS = 4;

function Band({
  id,
  icon,
  title,
  tint,
  more,
  children,
}: {
  id: string;
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  tint?: boolean;
  /** Link to the full page, only when the band shows a part of it. */
  more?: [href: string, label: string];
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titolo`}
      className={`mx-[calc(50%-50vw)] scroll-mt-28 px-4 py-12 sm:px-6 ${tint ? "bg-[#f7efe9]" : "bg-white"}`}
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <h2
          id={`${id}-titolo`}
          className="flex items-center gap-3 text-3xl font-extrabold text-bordeaux"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-bordeaux text-white">
            <Icon name={icon} />
          </span>
          {title}
        </h2>
        {children}
        {more && (
          <Link
            href={more[0]}
            className="inline-flex min-h-12 items-center gap-2 text-lg font-bold text-blu underline underline-offset-4"
          >
            {more[1]}
            <Icon name="next" />
          </Link>
        )}
      </div>
    </section>
  );
}

export default async function Home() {
  const [site, services] = await Promise.all([
    getSiteSettings(),
    getServices(),
  ]);
  const { pages, conventions, address } = site;
  const h = pages.home;
  // Only the first paragraph of Chi siamo: the history lives on its page.
  const story = pages.chiSiamo.intro.split(/\n\s*\n/)[0]?.trim();
  return (
    <div className="-mb-4 sm:-mb-6">
      <HomeHero
        slogan={site.slogan ?? DEFAULT_SLOGAN}
        servicesButton={h.servicesButton}
        whereButton={h.whereButton}
      />

      {services.length > 0 && (
        <Band id="servizi" icon="heart" title={pages.servizi.title}>
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((s) => (
              <ServiceCard key={s.id} s={s} />
            ))}
          </div>
        </Band>
      )}

      <div className="mx-[calc(50%-50vw)] bg-[#f7efe9] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-10">
          <HomeNews />
        </div>
      </div>

      {conventions.length > 0 && (
        <Band
          id="convenzioni"
          icon="tag"
          title={pages.convenzioni.title}
          more={
            conventions.length > MAX_CONVENTIONS
              ? ["/convenzioni", `Tutte le ${conventions.length} convenzioni`]
              : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {conventions.slice(0, MAX_CONVENTIONS).map((c, i) => (
              <ConventionCard key={`${i}-${c.title}`} c={c} name={c.title} />
            ))}
          </div>
        </Band>
      )}

      <Band
        id="chi-siamo"
        icon="hands"
        title={pages.chiSiamo.title}
        tint
        more={["/chi-siamo", "Leggi la nostra storia"]}
      >
        {story && <p className="max-w-3xl text-xl">{story}</p>}
        {h.quote.trim() && <HomeQuote quote={h.quote} source={h.quoteSource} />}
      </Band>

      <Band id="dove-siamo" icon="pin" title={pages.doveSiamo.title}>
        {address ? (
          <AddressMap address={address} />
        ) : (
          <p>L&apos;indirizzo sarà pubblicato a breve.</p>
        )}
      </Band>
    </div>
  );
}
