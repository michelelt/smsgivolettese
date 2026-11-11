import type { Metadata } from "next";
import { ChiSiamoBody, Paragraphs } from "@/components/public/page-bodies";
import { getSiteSettings } from "@/lib/public/server";
import { rich } from "@/lib/rich";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Chi siamo",
  description:
    "Una società di persone che si aiutano: la storia e i valori della SMS Givolettese.",
  alternates: { canonical: "/chi-siamo" },
};

export default async function ChiSiamo() {
  const p = (await getSiteSettings()).pages.chiSiamo;
  return (
    <ChiSiamoBody
      title={rich(p.title)}
      intro={<Paragraphs text={p.intro} />}
      sections={p.sections.map((s) => ({
        heading: rich(s.heading),
        body: <Paragraphs text={s.body} />,
        span: s.span,
        image: s.image,
      }))}
    />
  );
}
