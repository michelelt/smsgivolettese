"use client";

import { useRef, useState } from "react";
import { backdropClose } from "@/components/ui/dialog";

export type LightboxItem = { src: string; alt: string; caption?: string };

const btn =
  "min-h-12 min-w-12 rounded-xl border-2 border-white bg-black/70 px-4 text-lg font-bold text-white";

/**
 * Wraps one image group. Children are `<a href=full data-lightbox=index><img/></a>`:
 * without JS the link opens the file; with JS it opens the dialog (ADR-062).
 */
export function LightboxGroup({
  items,
  children,
}: {
  items: LightboxItem[];
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(0);
  const n = items.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const item = items[i];

  return (
    <>
      {/* The anchors inside stay the keyboard-operable controls; this only intercepts their click. */}
      <div
        onClick={(e) => {
          const a = (e.target as HTMLElement).closest<HTMLElement>(
            "a[data-lightbox]",
          );
          if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          setI(Number(a.dataset.lightbox) || 0);
          ref.current?.showModal();
        }}
      >
        {children}
      </div>
      <dialog
        ref={ref}
        aria-label="Foto ingrandita"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        {...backdropClose()}
        className="m-auto max-h-[96vh] w-[calc(100%-1rem)] max-w-5xl rounded-2xl border-2 border-ink bg-black p-3 text-white backdrop:bg-black/80"
      >
        {item && (
          <figure className="flex flex-col items-center gap-2">
            {/* Plain img: already WebP ≤ 2000 px, shown at natural ratio. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.src}
              alt={item.alt}
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
            {item.caption && (
              <figcaption className="text-lg">{item.caption}</figcaption>
            )}
          </figure>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {n > 1 && (
            <button type="button" className={btn} onClick={() => go(-1)}>
              ← Precedente
            </button>
          )}
          <p aria-live="polite" className="text-lg font-bold">
            {n > 1 ? `Foto ${i + 1} di ${n}` : ""}
          </p>
          {n > 1 && (
            <button type="button" className={btn} onClick={() => go(1)}>
              Successiva →
            </button>
          )}
          <button
            type="button"
            autoFocus
            className={btn}
            onClick={() => ref.current?.close()}
          >
            Chiudi
          </button>
        </div>
      </dialog>
    </>
  );
}
