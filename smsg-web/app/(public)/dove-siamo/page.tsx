import type { Metadata } from "next";
import { AddressMap } from "@/components/public/address-map";
import { Paragraphs, SimplePage } from "@/components/public/page-bodies";
import { getSiteSettings } from "@/lib/public/server";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Dove siamo",
  description: "La sede della SMS Givolettese a Givoletto.",
  alternates: { canonical: "/dove-siamo" },
};

export default async function DoveSiamo() {
  const { address, pages } = await getSiteSettings();
  return (
    <SimplePage
      title={pages.doveSiamo.title}
      intro={<Paragraphs text={pages.doveSiamo.intro} />}
    >
      {address ? (
        <AddressMap address={address} />
      ) : (
        <p>L&apos;indirizzo sarà pubblicato a breve.</p>
      )}
    </SimplePage>
  );
}
