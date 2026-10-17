"use client";

import { useRef } from "react";

const btn =
  "min-h-12 min-w-12 rounded-xl border-2 border-blu bg-white px-4 text-lg font-bold text-blu";

/** CSS scroll-snap carousel, manual only (no autoplay). Children are `<li>` items. */
export function Carousel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (d: number) => {
    const el = ref.current;
    if (!el) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: d * el.clientWidth * 0.9,
      behavior: calm ? "auto" : "smooth",
    });
  };
  return (
    <section aria-label={label}>
      <ul
        ref={ref}
        // Scrollable region must be keyboard-reachable (WCAG 2.1.1).
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [&>li]:w-72 [&>li]:shrink-0 [&>li]:snap-start"
      >
        {children}
      </ul>
      <div className="mt-2 flex gap-3">
        <button type="button" className={btn} onClick={() => scroll(-1)}>
          ← Indietro
        </button>
        <button type="button" className={btn} onClick={() => scroll(1)}>
          Avanti →
        </button>
      </div>
    </section>
  );
}
