import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { MainNav } from "@/components/public/main-nav";
import { TextSize } from "@/components/public/text-size";
import { bigButtonClass, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { httpsOnly, isHttps } from "@/lib/public/https-url";

// Shared by the public site and the staff WYSIWYG preview (/gestione/sito).
// The editor passes editable nodes where the public site passes plain text.

export const FOOTER_GROUPS = [
  ["associazioni", "Associazioni del territorio"],
  ["mutuo_soccorso", "Società di mutuo soccorso"],
  ["utili", "Link utili"],
] as const;
export type FooterGroup = (typeof FOOTER_GROUPS)[number][0];
export type FooterLink = { group: FooterGroup; label: string; url: string };
export type Convention = { title: string; description: string; url?: string };

/** `inert` (preview): the navigation is shown but cannot be used. */
export function PublicHeader({ inert }: { inert?: boolean }) {
  return (
    <header inert={inert} className="border-b-4 border-bordeaux bg-white">
      <div className="mx-auto max-w-5xl space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.svg" alt="" width={56} height={56} unoptimized />
            <span className="text-xl font-extrabold leading-tight text-bordeaux">
              SMS Givolettese
              <small className="block text-base font-normal text-ink">
                Società di Mutuo Soccorso · Givoletto
              </small>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <TextSize />
            <Link
              href="/accedi"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-blu bg-white px-4 font-bold text-blu hover:bg-[#edf1f8]"
            >
              <Icon name="lock" />
              Area riservata
            </Link>
          </div>
        </div>
        <MainNav />
      </div>
    </header>
  );
}

export const DEFAULT_SLOGAN = "Ci aiutiamo a vicenda, qui a Givoletto.";
export const DEFAULT_INTRO =
  "Servizi, convenzioni e momenti insieme per i soci e le loro famiglie.";

export function HomeHero({
  slogan,
  intro,
  servicesButton,
  whereButton,
  preview,
}: {
  slogan: ReactNode;
  intro: ReactNode;
  servicesButton: ReactNode;
  whereButton: ReactNode;
  /** Staff preview: buttons are not links (their labels are editable) and no second h1 on the page. */
  preview?: boolean;
}) {
  const H = preview ? "h2" : "h1";
  const items = [
    ["/servizi", "heart", servicesButton],
    ["/dove-siamo", "pin", whereButton],
  ] as const;
  return (
    <section className="space-y-4 rounded-2xl bg-blu p-6 text-white">
      <H className="text-4xl font-extrabold">{slogan}</H>
      <p className="whitespace-pre-line text-xl">{intro}</p>
      <div className="flex flex-wrap gap-3">
        {items.map(([href, icon, label]) =>
          preview ? (
            <span key={href} className={bigButtonClass("secondary")}>
              <Icon name={icon} />
              {label}
            </span>
          ) : (
            <ButtonLink key={href} href={href} variant="secondary">
              <Icon name={icon} />
              {label}
            </ButtonLink>
          ),
        )}
      </div>
    </section>
  );
}

export function HomeQuote({
  quote,
  source,
}: {
  quote: ReactNode;
  source: ReactNode;
}) {
  return (
    <blockquote className="border-l-8 border-bordeaux pl-4 italic">
      {quote}
      <footer className="mt-1 text-base not-italic">{source}</footer>
    </blockquote>
  );
}

export function ConventionCard({
  c,
  name,
  children,
}: {
  c: { title: ReactNode; description: ReactNode; url?: string | null };
  /** Plain title, for the screen reader text of the link. */
  name: string;
  /** Editor controls, rendered at the bottom of the card. */
  children?: ReactNode;
}) {
  return (
    <article className="space-y-3 rounded-2xl border-2 border-ink bg-white p-5">
      <h2 className="text-2xl font-extrabold text-bordeaux">{c.title}</h2>
      <p>{c.description}</p>
      {c.url && isHttps(c.url) && (
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center font-bold text-blu underline"
        >
          Sito della convenzione
          <span className="sr-only"> {name}</span> (si apre in una nuova scheda)
        </a>
      )}
      {children}
    </article>
  );
}

export function SiteFooter({
  links,
  address,
  vat,
  renderLink,
  groupEnd,
  inert,
}: {
  links: FooterLink[];
  address: ReactNode;
  vat: ReactNode;
  /** Editor: draws each link itself, keeps empty groups and non-https links. */
  renderLink?: (l: FooterLink, index: number) => ReactNode;
  groupEnd?: (g: FooterGroup) => ReactNode;
  inert?: boolean;
}) {
  const shown = renderLink ? links : httpsOnly(links);
  return (
    <footer className="mt-8 border-t-4 border-blu bg-white">
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        {(renderLink ||
          FOOTER_GROUPS.some(([g]) => shown.some((l) => l.group === g))) && (
          <div className="grid gap-6 sm:grid-cols-3">
            {FOOTER_GROUPS.map(([g, title]) => {
              const inGroup = shown.filter((l) => l.group === g);
              return (
                (renderLink || inGroup.length > 0) && (
                  <nav key={g} aria-label={title}>
                    <h2 className="text-xl font-extrabold text-bordeaux">
                      {title}
                    </h2>
                    <ul className="mt-2 space-y-1">
                      {inGroup.map((l, i) => (
                        <li key={`${i}-${l.url}`}>
                          {renderLink ? (
                            renderLink(l, links.indexOf(l))
                          ) : (
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center font-bold text-blu underline"
                            >
                              {l.label}
                              <span className="sr-only">
                                {" "}
                                (si apre in una nuova scheda)
                              </span>
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                    {groupEnd?.(g)}
                  </nav>
                )
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-3">
          <p>
            © Società di Mutuo Soccorso Givolettese
            {address && <> · {address}</>}
            {vat && <> · P. IVA {vat}</>}
          </p>
          <Link
            href="/privacy"
            inert={inert}
            className="inline-flex min-h-11 items-center font-bold text-blu underline"
          >
            Informativa sulla privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
