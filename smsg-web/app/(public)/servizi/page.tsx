import type { Metadata } from "next";
import { Paragraphs, SimplePage } from "@/components/public/page-bodies";
import { ServiceCard } from "@/components/public/service-card";
import { getServices, getSiteSettings } from "@/lib/public/server";
import { rich } from "@/lib/rich";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Servizi",
  description: "I servizi che la SMS Givolettese offre ai propri soci.",
  alternates: { canonical: "/servizi" },
};

export default async function Servizi() {
  const [services, { pages }] = await Promise.all([
    getServices(),
    getSiteSettings(),
  ]);
  return (
    <SimplePage
      title={rich(pages.servizi.title)}
      intro={<Paragraphs text={pages.servizi.intro} />}
    >
      {services.length === 0 ? (
        <p>Al momento non ci sono servizi in elenco.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              s={{
                name: rich(s.name),
                description: rich(s.description),
                scheduleNote: rich(s.scheduleNote),
              }}
            />
          ))}
        </div>
      )}
    </SimplePage>
  );
}
