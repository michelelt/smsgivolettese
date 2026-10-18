import Link from "next/link";

/** Prev/next as plain links (works without JS). `href(n)` builds the URL for page n. */
export function Pager({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (n: number) => string;
}) {
  if (pages <= 1) return null;
  const cls =
    "inline-flex min-h-12 items-center rounded-xl border-2 border-blu px-5 text-lg font-bold text-blu";
  return (
    <nav aria-label="Pagine" className="flex flex-wrap items-center gap-3">
      {page > 1 && (
        <Link href={href(page - 1)} className={cls} rel="prev">
          ← Precedente
        </Link>
      )}
      <span className="text-lg font-bold">
        Pagina {page} di {pages}
      </span>
      {page < pages && (
        <Link href={href(page + 1)} className={cls} rel="next">
          Successiva →
        </Link>
      )}
    </nav>
  );
}
