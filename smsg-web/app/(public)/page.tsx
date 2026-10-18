import type { Metadata } from "next";
import {
  DEFAULT_INTRO,
  DEFAULT_SLOGAN,
  HomeHero,
  HomeQuote,
} from "@/components/public/site-parts";
import { HomeNews } from "@/components/posts/home-sections";
import Image from "next/image";
import Link from "next/link";
import { Carousel } from "@/components/posts/carousel";
import { PostCard } from "@/components/posts/post-card";
import { mediaUrl } from "@/lib/media-url";
import { getGallery, getPosts, getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: { absolute: "SMS Givolettese — Società di Mutuo Soccorso" },
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [site, events, gallery] = await Promise.all([
    getSiteSettings(),
    getPosts({ category: "evento", upcoming: "true", pageSize: 3 }),
    getGallery(1, 8),
  ]);
  const h = site.pages.home;
  return (
    <div className="space-y-10">
      <HomeHero
        slogan={site.slogan ?? DEFAULT_SLOGAN}
        intro={site.homeIntro ?? DEFAULT_INTRO}
        servicesButton={h.servicesButton}
        whereButton={h.whereButton}
      />
      <HomeNews />
      {events.items.length > 0 && (
        <section aria-labelledby="home-eventi" className="space-y-4">
          <h2
            id="home-eventi"
            className="text-3xl font-extrabold text-bordeaux"
          >
            Prossimi appuntamenti
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.items.map((p) => (
              <PostCard key={p.slug} p={p} />
            ))}
          </div>
          <Link
            href="/notizie"
            className="inline-flex min-h-12 items-center text-lg font-bold text-blu underline underline-offset-4"
          >
            Tutte le notizie
          </Link>
        </section>
      )}
      {gallery.items.length > 0 && (
        <section aria-labelledby="home-galleria" className="space-y-4">
          <h2
            id="home-galleria"
            className="text-3xl font-extrabold text-bordeaux"
          >
            Galleria
          </h2>
          <Carousel label="Foto delle nostre attività">
            {gallery.items.map((g) =>
              g.cover ? (
                <li key={g.slug}>
                  <Link href={`/notizie/${g.slug}`} className="block space-y-1">
                    <Image
                      src={mediaUrl(g.cover.path)}
                      alt=""
                      width={g.cover.width || 800}
                      height={g.cover.height || 600}
                      sizes="288px"
                      className="aspect-[4/3] w-full rounded-xl object-cover"
                    />
                    <span className="block font-bold text-blu underline">
                      {g.title}
                    </span>
                  </Link>
                </li>
              ) : null,
            )}
          </Carousel>
          <Link
            href="/galleria"
            className="inline-flex min-h-12 items-center text-lg font-bold text-blu underline underline-offset-4"
          >
            Tutta la galleria
          </Link>
        </section>
      )}
      {h.quote.trim() && <HomeQuote quote={h.quote} source={h.quoteSource} />}
    </div>
  );
}
