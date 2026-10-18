import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Pager } from "@/components/posts/pager";
import { SimplePage } from "@/components/public/page-bodies";
import { mediaUrl } from "@/lib/media-url";
import { getGallery } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Galleria",
  description: "Le foto delle nostre attività.",
  alternates: { canonical: "/galleria" },
};

const PAGE_SIZE = 24;

export default async function Galleria({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const page = Math.max(
    1,
    Number.parseInt((await searchParams).pagina ?? "1", 10) || 1,
  );
  const { items, total } = await getGallery(page, PAGE_SIZE);
  return (
    <SimplePage title="Galleria">
      {items.length === 0 ? (
        <p>Non ci sono ancora foto.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map((g) =>
            g.cover ? (
              <li key={g.slug}>
                <Link href={`/notizie/${g.slug}`} className="block space-y-2">
                  <Image
                    src={mediaUrl(g.cover.path)}
                    alt=""
                    width={g.cover.width || 800}
                    height={g.cover.height || 600}
                    sizes="(min-width: 768px) 33vw, 50vw"
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                  <span className="block font-bold text-blu underline underline-offset-4">
                    {g.title}
                  </span>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      )}
      <Pager
        page={page}
        pages={Math.ceil(total / PAGE_SIZE)}
        href={(n) => `/galleria?pagina=${n}`}
      />
    </SimplePage>
  );
}
