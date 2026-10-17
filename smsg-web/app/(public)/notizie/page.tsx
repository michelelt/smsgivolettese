import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/posts/post-card";
import { Pager } from "@/components/posts/pager";
import { SimplePage } from "@/components/public/page-bodies";
import { getPosts } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Eventi e novità",
  description: "Eventi, avvisi e notizie della SMS Givolettese.",
  alternates: { canonical: "/notizie" },
};

const PAGE_SIZE = 10;
const FILTERS = [
  [undefined, "Tutto"],
  ["evento", "Eventi"],
  ["avviso", "Avvisi"],
  ["notizia", "Notizie"],
] as const;
const isCat = (v?: string): v is "evento" | "avviso" | "notizia" =>
  v === "evento" || v === "avviso" || v === "notizia";

export default async function Notizie({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const category = isCat(sp.categoria) ? sp.categoria : undefined;
  const page = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);
  const { items, total } = await getPosts({
    category,
    page,
    pageSize: PAGE_SIZE,
  });
  const url = (n: number) =>
    `/notizie?${new URLSearchParams({ ...(category ? { categoria: category } : {}), pagina: String(n) })}`;

  return (
    <SimplePage title="Eventi e novità">
      <nav aria-label="Filtra per tipo">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map(([v, label]) => {
            const on = v === category;
            return (
              <li key={label}>
                <Link
                  href={v ? `/notizie?categoria=${v}` : "/notizie"}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-12 items-center rounded-xl border-2 border-blu px-5 text-lg font-bold ${on ? "bg-blu text-white underline" : "bg-white text-blu"}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {items.length === 0 ? (
        <p>Non ci sono ancora pubblicazioni in questa sezione.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((p) => (
            <PostCard key={p.slug} p={p} />
          ))}
        </div>
      )}
      <Pager page={page} pages={Math.ceil(total / PAGE_SIZE)} href={url} />
      <p>
        Hai una notizia da condividere?{" "}
        <Link href="/proponi" className="font-bold text-blu underline">
          Proponi una notizia
        </Link>
      </p>
    </SimplePage>
  );
}
