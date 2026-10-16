import Link from "next/link";
import { TransportForm } from "@/components/gestione/transport-form";

export default function NuovoTrasporto() {
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
      <TransportForm />
    </>
  );
}
