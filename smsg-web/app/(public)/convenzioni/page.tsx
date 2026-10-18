import type { Metadata } from "next";
import { Paragraphs, SimplePage } from "@/components/public/page-bodies";
import { ConventionCard } from "@/components/public/site-parts";
import { getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Convenzioni",
  description: "Le convenzioni della SMS Givolettese a favore dei soci.",
  alternates: { canonical: "/convenzioni" },
};

export default async function Convenzioni() {
  const { conventions, pages } = await getSiteSettings();
  return (
    <SimplePage
      title={pages.convenzioni.title}
      intro={<Paragraphs text={pages.convenzioni.intro} />}
    >
      {conventions.length === 0 ? (
        <p>Al momento non ci sono convenzioni in elenco.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {conventions.map((c, i) => (
            <ConventionCard key={`${i}-${c.title}`} c={c} name={c.title} />
          ))}
        </div>
      )}
    </SimplePage>
  );
}
