import type { Metadata } from "next";
import { VerifyForm } from "./form";

export const metadata: Metadata = {
  title: "Codice di accesso — SMS Givolettese",
};

export default async function Verifica({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Codice di accesso
      </h1>
      <VerifyForm next={next} />
    </main>
  );
}
