import Link from "next/link";
import { z } from "zod";
import {
  TransportForm,
  TransportFormForMember,
} from "@/components/gestione/transport-form";

export default async function NuovoTrasporto({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const member = z
    .string()
    .uuid()
    .safeParse((await searchParams).member);
  return (
    <>
      <p>
        <Link
          className="font-bold text-blu underline"
          href="/gestione/trasporti"
        >
          ← Tutti i trasporti
        </Link>
      </p>
      <h1 className="mt-2 text-4xl font-extrabold text-bordeaux">
        Nuovo trasporto
      </h1>
      {member.data ? (
        <TransportFormForMember memberId={member.data} />
      ) : (
        <TransportForm />
      )}
    </>
  );
}
