import type { Metadata } from "next";
import { ConventionCard } from "@/components/public/site-parts";
import { getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Convenzioni",
  description: "Le convenzioni della SMS Givolettese a favore dei soci.",
  alternates: { canonical: "/convenzioni" },
};

export default async function Convenzioni() {
  const { conventions } = await getSiteSettings();
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">Convenzioni</h1>
      {conventions.length === 0 ? (
        <p>Al momento non ci sono convenzioni in elenco.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {conventions.map((c, i) => (
            <ConventionCard key={`${i}-${c.title}`} c={c} name={c.title} />
          ))}
        </div>
      )}
    </div>
  );
}
