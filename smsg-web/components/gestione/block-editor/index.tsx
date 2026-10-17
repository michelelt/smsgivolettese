"use client";

import dynamic from "next/dynamic";

/** The editor bundle loads only in /gestione, never on public pages (ADR-062). */
export const BlockEditor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: () => (
    <p role="status" className="text-lg">
      Caricamento dell&apos;editor…
    </p>
  ),
});
export type { UploadFn } from "./upload-context";
