import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";
import { getSiteSettings, telHref } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Contatti",
  description:
    "Indirizzo, telefono, email e orari di apertura della SMS Givolettese.",
  alternates: { canonical: "/contatti" },
};

export default async function Contatti() {
  const s = await getSiteSettings();
  const cards = [
    {
      icon: "pin",
      title: "Indirizzo",
      body: s.address && (
        <>
          <p className="text-xl">{s.address}</p>
          <a
            className="font-bold text-blu underline"
            href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(s.address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apri la mappa (si apre in una nuova scheda)
          </a>
        </>
      ),
    },
    {
      icon: "phone",
      title: "Telefono",
      body: s.phone && (
        <a
          className="text-3xl font-extrabold text-bordeaux underline"
          href={telHref(s.phone)}
        >
          {s.phone}
        </a>
      ),
    },
    {
      icon: "mail",
      title: "Email",
      body: s.email && (
        <a
          className="break-words text-xl font-bold text-blu underline"
          href={`mailto:${s.email}`}
        >
          {s.email}
        </a>
      ),
    },
    {
      icon: "clock",
      title: "Orari di apertura",
      body: s.openingHours && (
        <p className="whitespace-pre-line text-xl">{s.openingHours}</p>
      ),
    },
  ] as const;
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Dove siamo e quando
      </h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <section
            key={c.title}
            className="space-y-2 rounded-2xl border-2 border-ink bg-white p-5"
          >
            <h2 className="flex items-center gap-2 text-2xl font-extrabold">
              <Icon name={c.icon} />
              {c.title}
            </h2>
            {c.body || <p>Non ancora indicato.</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
