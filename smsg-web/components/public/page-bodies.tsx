import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

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
      <div className="max-w-prose space-y-4">
        <Title preview={preview}>{title}</Title>
        {intro}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((s, i) => (
          <section
            key={i}
            className="rounded-2xl border-2 border-ink bg-white p-5"
          >
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
    <div className="max-w-prose space-y-4">
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

/** Title + optional intro, then the page content. `wide`: card grids use the full width. */
export function SimplePage({
  title,
  intro,
  preview,
  prose,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  preview?: boolean;
  prose?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={prose ? "max-w-prose space-y-4" : "space-y-6"}>
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
