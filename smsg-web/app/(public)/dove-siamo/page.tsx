import type { Metadata } from "next";
import { Icon } from "@/components/ui/icon";
import { getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Dove siamo",
  description: "La sede della SMS Givolettese a Givoletto.",
  alternates: { canonical: "/dove-siamo" },
};

export default async function DoveSiamo() {
  const { address } = await getSiteSettings();
  return (
    <div className="max-w-prose space-y-4">
      <h1 className="text-4xl font-extrabold text-bordeaux">Dove siamo</h1>
      {address ? (
        <>
          <p className="flex items-start gap-2 text-xl">
            <Icon name="pin" /> <span>{address}</span>
          </p>
          <a
            className="font-bold text-blu underline"
            href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apri la mappa (si apre in una nuova scheda)
          </a>
        </>
      ) : (
        <p>L&apos;indirizzo sarà pubblicato a breve.</p>
      )}
    </div>
  );
}
