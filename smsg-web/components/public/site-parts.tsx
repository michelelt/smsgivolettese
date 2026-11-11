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
    <header
      inert={inert}
      className={`${inert ? "relative" : "sticky top-0"} z-30 border-b-4 border-bordeaux bg-[#f7efe9]`}
    >
      <div className="mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo-badge.svg"
            alt="SMS Givolettese, pagina iniziale"
            width={150}
            height={120}
            unoptimized
            className="h-[64px] w-auto"
          />
        </Link>
        <MainNav
          tools={
            <>
              <TextSize />
              <Link
                href="/accedi"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-bordeaux px-4 text-[0.85rem] font-bold uppercase tracking-widest text-white hover:bg-[#5e1622]"
              >
                <Icon name="lock" />
                Area riservata
              </Link>
            </>
          }
        />
      </div>
    </header>
  );
}

export const DEFAULT_SLOGAN = "Ci aiutiamo a vicenda, qui a Givoletto.";

export function HomeHero({
  slogan,
  servicesButton,
  whereButton,
  preview,
}: {
  slogan: ReactNode;
  servicesButton: ReactNode;
  whereButton: ReactNode;
  /** Staff preview: buttons are not links (their labels are editable) and no second h1 on the page. */
  preview?: boolean;
}) {
  const H = preview ? "h2" : "h1";
  const items = [
    // Jumps down the same page: the home holds every topic.
    ["/#servizi", "heart", servicesButton],
    ["/#dove-siamo", "pin", whereButton],
  ] as const;
  return (
    <section
      className={`relative isolate overflow-hidden text-white ${preview ? "rounded-2xl" : "-mt-4 mx-[calc(50%-50vw)] sm:-mt-6"}`}
    >
      {/* shortcut: stock photo, replace with a real photo of Givoletto. */}
      <Image
        src="/hero-stock.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-black/45 to-black/70" />
      <div className="mx-auto flex min-h-[55svh] max-w-5xl flex-col items-center justify-center gap-5 px-4 py-16 text-center">
        <Image
          src="/logo-badge.svg"
          alt=""
          width={150}
          height={120}
          unoptimized
          className="h-32 w-auto drop-shadow-xl sm:h-40"
        />
        {/* Wording of the logo, white version cut from logo-orizzontale-negativo.svg, under the badge. */}
        <H className="w-full max-w-xl">
          <Image
            src="/logo-scritta-negativo.svg"
            alt="Società di Mutuo Soccorso Givolettese"
            width={293}
            height={71}
            unoptimized
            className="mx-auto h-auto w-full drop-shadow-lg"
          />
        </H>
        <p className="text-xl font-bold drop-shadow sm:text-3xl">{slogan}</p>
        <div className="flex flex-wrap justify-center gap-3">
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

const SOCIAL = ["facebook", "instagram"] as const;

function socialOf(url: string) {
  const host = new URL(url).hostname;
  return SOCIAL.find((n) => host === `${n}.com` || host.endsWith(`.${n}.com`));
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
  const all = renderLink ? links : httpsOnly(links);
  // Facebook / Instagram links from the footer list become icons (public site only; the editor keeps them in the list).
  const social = renderLink
    ? []
    : all.flatMap((l) => {
        const name = socialOf(l.url);
        return name ? [{ ...l, name }] : [];
      });
  const shown = all.filter((l) => !social.some((x) => x.url === l.url));
  return (
    <footer className="mt-8 border-t-4 border-bordeaux bg-[#f7efe9] text-sm">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-4">
        {(renderLink ||
          social.length > 0 ||
          FOOTER_GROUPS.some(([g]) => shown.some((l) => l.group === g))) && (
          <div className="grid gap-3 sm:grid-cols-3">
            {FOOTER_GROUPS.map(([g, title]) => {
              const inGroup = shown.filter((l) => l.group === g);
              return (
                (renderLink || inGroup.length > 0) && (
                  <nav key={g} aria-label={title}>
                    <h2 className="font-extrabold text-bordeaux">{title}</h2>
                    <ul>
                      {inGroup.map((l, i) => (
                        <li key={`${i}-${l.url}`}>
                          {renderLink ? (
                            renderLink(l, links.indexOf(l))
                          ) : (
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-6 items-center font-bold text-blu underline"
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
            {social.length > 0 && (
              <div className="space-y-2 sm:col-start-3">
                <h2 className="font-extrabold text-bordeaux">Seguici</h2>
                <ul className="flex gap-3">
                  {social.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${l.label} (si apre in una nuova scheda)`}
                        title={l.label}
                        className="grid size-12 place-items-center rounded-full bg-bordeaux text-white hover:bg-[#5e1622]"
                      >
                        <Icon name={l.name} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-bordeaux/20 pt-2">
          <Image
            src="/logo-orizzontale.svg"
            alt=""
            width={467}
            height={120}
            unoptimized
            className="h-12 w-auto"
          />
          <p>
            © Società di Mutuo Soccorso Givolettese
            {address && <> · {address}</>}
            {vat && <> · P. IVA {vat}</>}
          </p>
          <Link
            href="/privacy"
            inert={inert}
            className="inline-flex min-h-6 items-center font-bold text-blu underline"
          >
            Informativa sulla privacy
          </Link>
        </div>
        <p className="text-center text-xs text-ink/70">
          Fatto con &lt;3 da{" "}
          <a
            href="https://www.linkedin.com/in/michele-cocca/"
            target="_blank"
            rel="noopener noreferrer"
            inert={inert}
            className="underline"
          >
            Michele Cocca
            <span className="sr-only"> (si apre in una nuova scheda)</span>
          </a>
        </p>
      </div>
    </footer>
  );
}
