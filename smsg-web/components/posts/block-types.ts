import type { components } from "@/lib/api/schema";

/** Generated wire type (the contract). */
export type ApiBlock = components["schemas"]["Block"];

// Renderer view of the same data: loose on purpose, every prop is re-validated on render (whitelist).
export type Inline =
  | {
      type: "text";
      text: string;
      styles?: { bold?: boolean; italic?: boolean; underline?: boolean };
    }
  | { type: "link"; href: string; content: Inline[] };

export type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content?: Inline[];
  children: Block[];
};

export type PostMedia = NonNullable<components["schemas"]["Media"]>;

export const MEDIA_PATH =
  /^\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png|mp4|webm)$/;
export const YOUTUBE_ID = /^[\w-]{11}$/;
export const VIMEO_ID = /^\d{6,12}$/;
