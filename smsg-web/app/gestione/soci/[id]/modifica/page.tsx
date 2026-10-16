"use client";

import { useParams } from "next/navigation";
import { Loading } from "@/components/ui/bits";
import { MemberForm } from "@/components/gestione/member-form";
import { useMember } from "@/lib/api/hooks";

export default function ModificaSocio() {
  const { id } = useParams<{ id: string }>();
  const q = useMember(id);
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Modifica dati del socio
      </h1>
      <Loading query={q} />
      {q.data && <MemberForm member={q.data} />}
    </>
  );
}
