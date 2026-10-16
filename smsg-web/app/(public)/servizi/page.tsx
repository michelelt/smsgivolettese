import type { Metadata } from "next";
import { ServiceCard } from "@/components/public/service-card";
import { getServices } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Servizi e prezzi",
  description:
    "I servizi della SMS Givolettese con i prezzi per soci e non soci.",
  alternates: { canonical: "/servizi" },
};

export default async function Servizi() {
  const services = await getServices();
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Cosa possiamo fare per Lei
      </h1>
      <p>I prezzi sono indicati per i soci e per chi non è ancora socio.</p>
      {services.length === 0 ? (
        <p>
          Al momento non ci sono servizi in elenco. Ci telefoni per
          informazioni.
        </p>
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
