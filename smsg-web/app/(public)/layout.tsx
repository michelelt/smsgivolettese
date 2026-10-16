import { PublicHeader, SiteFooter } from "@/components/public/site-parts";
import { getSiteSettings } from "@/lib/public/server";

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
      <PublicHeader />
      <main
        id="contenuto"
        tabIndex={-1}
        className="mx-auto max-w-5xl p-4 outline-none sm:p-6"
      >
        {children}
      </main>
      <SiteFooter
        links={site.footerLinks}
        address={site.address}
        vat={site.vatNumber}
      />
    </>
  );
}
