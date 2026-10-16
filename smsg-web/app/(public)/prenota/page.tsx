import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingWizard } from "@/components/public/booking-wizard";
import { parseEnv } from "@/lib/env";
import { getServices, getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Prenota una prestazione",
  description:
    "Prenoti online in quattro passi: scelga il servizio, il giorno, lasci nome e telefono.",
  alternates: { canonical: "/prenota" },
};

export default async function Prenota() {
  const [services, site] = await Promise.all([
    getServices(),
    getSiteSettings(),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Prenoti una prestazione
      </h1>
      <Suspense fallback={<p role="status">Caricamento…</p>}>
        <BookingWizard
          services={services.filter((s) => s.bookable)}
          phone={site.phone}
          siteKey={parseEnv(process.env).NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        />
      </Suspense>
    </div>
  );
}
