import type { Metadata } from "next";
import { ServiceCard } from "@/components/public/service-card";
import { getServices } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Servizi",
  description: "I servizi che la SMS Givolettese offre ai propri soci.",
  alternates: { canonical: "/servizi" },
};

export default async function Servizi() {
  const services = await getServices();
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">
        I nostri servizi
      </h1>
      {services.length === 0 ? (
        <p>Al momento non ci sono servizi in elenco.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <ServiceCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
