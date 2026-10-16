import Image from "next/image";
import Link from "next/link";
import { MainNav } from "@/components/public/main-nav";
import { TextSize } from "@/components/public/text-size";
import { Icon } from "@/components/ui/icon";
import { getSiteSettings, telHref } from "@/lib/public/server";

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
          {site.phone && (
            <a
              href={telHref(site.phone)}
              className="flex min-h-14 items-center justify-center gap-3 rounded-xl bg-bordeaux px-4 text-xl font-extrabold text-white"
            >
              <Icon name="phone" />
              <span>
                Ci telefoni:{" "}
                <span className="whitespace-nowrap">{site.phone}</span>
              </span>
            </a>
          )}
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
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3 p-4">
          <p>
            © Società di Mutuo Soccorso Givolettese
            {site.address && <> · {site.address}</>}
          </p>
          <Link href="/privacy" className="font-bold text-blu underline">
            Informativa sulla privacy
          </Link>
        </div>
      </footer>
    </>
  );
}
