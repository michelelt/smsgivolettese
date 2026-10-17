import type { Metadata } from "next";
import { SecurityPanel } from "./panel";

export const metadata: Metadata = { title: "Sicurezza — SMS Givolettese" };

export default async function Sicurezza({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Sicurezza dell&apos;account
      </h1>
      <SecurityPanel next={next} />
    </>
  );
}
