import Image from "next/image";
import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { fmtDate } from "@/lib/dates";
import { mediaUrl } from "@/lib/media-url";

export const CATEGORY = {
  evento: "Evento",
  avviso: "Avviso",
  notizia: "Notizia",
} as const;

type Item = components["schemas"]["PublicPostItem"];

/** The category is always written out, never conveyed by colour alone. */
export function PostCard({ p }: { p: Item }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white">
      {p.cover && (
        <Image
          src={mediaUrl(p.cover.path)}
          alt={p.cover.alt ?? ""}
          width={p.cover.width || 800}
          height={p.cover.height || 600}
          sizes="(min-width: 640px) 50vw, 100vw"
          className="aspect-[4/3] w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-bold text-blu">
          {CATEGORY[p.category]}
          {p.eventDate ? ` · ${fmtDate(p.eventDate)}` : ""}
          {p.location ? ` · ${p.location}` : ""}
        </p>
        <h2 className="text-2xl font-extrabold text-bordeaux">
          <Link
            href={`/notizie/${p.slug}`}
            className="underline underline-offset-4"
          >
            {p.title}
          </Link>
        </h2>
        {p.excerpt && <p>{p.excerpt}</p>}
        <Link
          href={`/notizie/${p.slug}`}
          aria-label={`Leggi tutto: ${p.title}`}
          className="mt-auto inline-flex min-h-12 items-center font-bold text-blu underline underline-offset-4"
        >
          Leggi tutto
        </Link>
      </div>
    </article>
  );
}
