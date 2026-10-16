import type { Metadata } from "next";
import { Paragraphs, PrivacyBody } from "@/components/public/page-bodies";
import { getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Informativa sulla privacy",
  alternates: { canonical: "/privacy" },
};

export default async function Privacy() {
  const p = (await getSiteSettings()).pages.privacy;
  return (
    <PrivacyBody
      title={p.title}
      intro={<Paragraphs text={p.intro} />}
      sections={p.sections.map((s) => ({
        heading: s.heading,
        body: <Paragraphs text={s.body} />,
      }))}
    />
  );
}
