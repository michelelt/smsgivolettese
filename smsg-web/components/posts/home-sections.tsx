import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { fmtDate } from "@/lib/dates";
import { mediaUrl } from "@/lib/media-url";
import { getGallery, getPosts } from "@/lib/public/server";
import { Carousel } from "./carousel";

/** Home blocks fed by the bacheca; each renders nothing when empty. */
export async function HomeNews() {
  const [events, gallery] = await Promise.all([
    getPosts({ upcoming: "true", pageSize: 3 }),
    getGallery(1, 8),
  ]);
  const photos = gallery.items.filter((g) => g.cover);
  return (
    <>
      {events.items.length > 0 && (
        <section aria-labelledby="home-eventi" className="space-y-4">
          <h2
            id="home-eventi"
            className="text-2xl font-extrabold text-bordeaux"
          >
            Prossimi eventi
          </h2>
          <ul className="space-y-4">
            {events.items.map((p) => (
              <li
                key={p.slug}
                className="rounded-2xl border-2 border-ink bg-white p-4"
              >
                <p className="font-bold text-blu">
                  {p.eventDate ? fmtDate(p.eventDate) : "Evento"}
                  {p.location ? ` · ${p.location}` : ""}
                </p>
                <h3 className="text-xl font-extrabold">{p.title}</h3>
                {p.excerpt && <p>{p.excerpt}</p>}
                <Link
                  href={`/notizie/${p.slug}`}
                  aria-label={`Testo completo: ${p.title}`}
                  className="inline-flex min-h-12 items-center font-bold text-blu underline underline-offset-4"
                >
                  Testo completo
                </Link>
              </li>
            ))}
          </ul>
          <ButtonLink href="/notizie" variant="secondary">
            Tutte le notizie
          </ButtonLink>
        </section>
      )}
      {photos.length > 0 && (
        <section aria-labelledby="home-galleria" className="space-y-4">
          <h2
            id="home-galleria"
            className="text-2xl font-extrabold text-bordeaux"
          >
            Dalla galleria
          </h2>
          <Carousel label="Foto recenti">
            {photos.map((g) => (
              <li key={g.slug}>
                <Link href={`/notizie/${g.slug}`} className="block space-y-1">
                  <Image
                    src={mediaUrl(g.cover!.path)}
                    alt=""
                    width={g.cover!.width || 800}
                    height={g.cover!.height || 600}
                    sizes="288px"
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                  <span className="block font-bold text-blu underline underline-offset-4">
                    {g.title}
                  </span>
                </Link>
              </li>
            ))}
          </Carousel>
          <ButtonLink href="/galleria" variant="secondary">
            Vai alla galleria
          </ButtonLink>
        </section>
      )}
    </>
  );
}
