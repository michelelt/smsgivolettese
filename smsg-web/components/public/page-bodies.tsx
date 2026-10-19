import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { mediaUrl } from "@/lib/media-url";

// Page bodies shared by the public site and the staff editor (/gestione/sito).
// Text props are ReactNode: the editor passes editable nodes, the site passes plain text.

/** Plain text, blank line = new paragraph. Rendered as React text, never as HTML. */
export function Paragraphs({ text }: { text: string }) {
  return text
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p, i) => (
      <p key={i} className="whitespace-pre-line">
        {p.trim()}
      </p>
    ));
}

export type PageSection = {
  heading: ReactNode;
  body: ReactNode;
  /** Editor controls (move, remove). */
  controls?: ReactNode;
  /** Chi siamo only: width in fifths of the row on wide screens. */
  span?: number;
  image?: { path: string; alt: string; width?: number; height?: number };
};

function Title({
  preview,
  children,
}: {
  preview?: boolean;
  children: ReactNode;
}) {
  const H = preview ? "h2" : "h1";
  return <H className="text-4xl font-extrabold text-bordeaux">{children}</H>;
}

function SectionHeading({
  preview,
  children,
}: {
  preview?: boolean;
  children: ReactNode;
}) {
  const H = preview ? "h3" : "h2";
  return <H className="text-2xl font-extrabold">{children}</H>;
}

export function ChiSiamoBody({
  title,
  intro,
  sections,
  after,
  preview,
}: {
  title: ReactNode;
  intro: ReactNode;
  sections: PageSection[];
  after?: ReactNode;
  preview?: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Title preview={preview}>{title}</Title>
        {intro}
      </div>
      {/* Boxes grow in proportion to their span and wrap when a row passes 5/5. */}
      <div className="flex flex-wrap gap-4">
        {sections.map((s, i) => (
          <section
            key={i}
            style={{ "--span": s.span ?? 1 } as CSSProperties}
            className="min-w-0 basis-full rounded-2xl border-2 border-ink bg-white p-5 sm:grow sm:basis-[calc(50%-0.5rem)] lg:grow-(--span) lg:basis-[calc(var(--span)*20%-1rem)]"
          >
            {s.image && (
              <Image
                src={mediaUrl(s.image.path)}
                alt={s.image.alt}
                width={s.image.width || 800}
                height={s.image.height || 600}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="mb-4 aspect-[4/3] w-full rounded-xl object-cover"
              />
            )}
            <SectionHeading preview={preview}>{s.heading}</SectionHeading>
            <div className="mt-2 space-y-2">{s.body}</div>
            {s.controls}
          </section>
        ))}
      </div>
      {after}
    </div>
  );
}

export function PrivacyBody({
  title,
  intro,
  sections,
  after,
  preview,
}: {
  title: ReactNode;
  intro: ReactNode;
  sections: PageSection[];
  after?: ReactNode;
  preview?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Title preview={preview}>{title}</Title>
      {intro}
      {sections.map((s, i) => (
        <section key={i} className="space-y-4">
          <SectionHeading preview={preview}>{s.heading}</SectionHeading>
          {s.body}
          {s.controls}
        </section>
      ))}
      {after}
    </div>
  );
}

/** Title + optional intro, then the page content. */
export function SimplePage({
  title,
  intro,
  preview,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  preview?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Title preview={preview}>{title}</Title>
      {intro}
      {children}
    </div>
  );
}

export function AddressBlock({
  address,
  mapQuery,
  preview,
}: {
  address: ReactNode;
  /** Plain address for the map link; empty = no link. */
  mapQuery: string;
  preview?: boolean;
}) {
  return (
    <>
      <p className="flex items-start gap-2 text-xl">
        <Icon name="pin" /> <span>{address}</span>
      </p>
      {mapQuery && (
        <a
          className="font-bold text-blu underline"
          href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(mapQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
          inert={preview}
        >
          Apri la mappa (si apre in una nuova scheda)
        </a>
      )}
    </>
  );
}
