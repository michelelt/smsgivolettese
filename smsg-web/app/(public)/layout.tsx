import Image from "next/image";
import Link from "next/link";
import { MainNav } from "@/components/public/main-nav";
import { TextSize } from "@/components/public/text-size";
import { httpsOnly } from "@/lib/public/https-url";
import { getSiteSettings } from "@/lib/public/server";

const GROUPS = [
  ["associazioni", "Associazioni del territorio"],
  ["mutuo_soccorso", "Società di mutuo soccorso"],
  ["utili", "Link utili"],
] as const;

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getSiteSettings();
  return (
    <>
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-3 focus:font-bold"
      >
        Vai al contenuto
      </a>
      <header className="border-b-4 border-bordeaux bg-white">
        <div className="mx-auto max-w-5xl space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.svg"
                alt=""
                width={56}
                height={56}
                unoptimized
              />
              <span className="text-xl font-extrabold leading-tight text-bordeaux">
                SMS Givolettese
                <small className="block text-base font-normal text-ink">
                  Società di Mutuo Soccorso · Givoletto
                </small>
              </span>
            </Link>
            <TextSize />
          </div>
          <MainNav />
        </div>
      </header>
      <main
        id="contenuto"
        tabIndex={-1}
        className="mx-auto max-w-5xl p-4 outline-none sm:p-6"
      >
        {children}
      </main>
      <footer className="mt-8 border-t-4 border-blu bg-white">
        <div className="mx-auto max-w-5xl space-y-6 p-4">
          {GROUPS.some(([g]) =>
            httpsOnly(site.footerLinks).some((l) => l.group === g),
          ) && (
            <div className="grid gap-6 sm:grid-cols-3">
              {GROUPS.map(([g, title]) => {
                const links = httpsOnly(site.footerLinks).filter(
                  (l) => l.group === g,
                );
                return (
                  links.length > 0 && (
                    <nav key={g} aria-label={title}>
                      <h2 className="text-xl font-extrabold text-bordeaux">
                        {title}
                      </h2>
                      <ul className="mt-2 space-y-1">
                        {links.map((l, i) => (
                          <li key={`${i}-${l.url}`}>
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
                          </li>
                        ))}
                      </ul>
                    </nav>
                  )
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-3">
            <p>
              © Società di Mutuo Soccorso Givolettese
              {site.address && <> · {site.address}</>}
              {site.vatNumber && <> · P. IVA {site.vatNumber}</>}
            </p>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center font-bold text-blu underline"
            >
              Informativa sulla privacy
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
