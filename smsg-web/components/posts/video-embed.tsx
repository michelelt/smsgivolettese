"use client";

import { useEffect, useRef, useState } from "react";
import { bigButtonClass } from "@/components/ui/button";

/** Click-to-load: no third-party request until the reader asks for it (privacy). */
export function VideoEmbed({
  provider,
  src,
  title,
}: {
  provider: "YouTube" | "Vimeo";
  src: string;
  title: string;
}) {
  const [on, setOn] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (on) frame.current?.focus();
  }, [on]);
  if (on)
    return (
      <iframe
        ref={frame}
        src={src}
        title={title || "Video"}
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="aspect-video w-full rounded-xl"
      />
    );
  return (
    <div className="rounded-xl border-2 border-ink/30 p-4">
      <button
        type="button"
        onClick={() => setOn(true)}
        className={bigButtonClass()}
      >
        Guarda il video ({provider})
      </button>
      <p className="mt-2 text-base">
        Il video è fornito da {provider}: premendo il pulsante la pagina si
        collega al loro servizio.
      </p>
    </div>
  );
}
