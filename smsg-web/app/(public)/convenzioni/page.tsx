import type { Metadata } from "next";
import { isHttps } from "@/lib/public/https-url";
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
            <article
              key={`${i}-${c.title}`}
              className="space-y-3 rounded-2xl border-2 border-ink bg-white p-5"
            >
              <h2 className="text-2xl font-extrabold text-bordeaux">
                {c.title}
              </h2>
              <p>{c.description}</p>
              {c.url && isHttps(c.url) && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-bold text-blu underline"
                >
                  Sito della convenzione
                  <span className="sr-only"> {c.title}</span> (si apre in una
                  nuova scheda)
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
