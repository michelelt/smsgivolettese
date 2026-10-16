"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loading } from "@/components/ui/bits";
import { MemberForm } from "@/components/gestione/member-form";
import { useClient } from "@/lib/api/hooks";

function WithClient({ id }: { id: string }) {
  const q = useClient(id);
  return (
    <>
      <Loading query={q} />
      {q.data && <MemberForm client={q.data} />}
    </>
  );
}

function Inner() {
  const clientId = useSearchParams().get("clientId");
  return clientId ? <WithClient id={clientId} /> : <MemberForm />;
}

export default function NuovoSocio() {
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Nuovo socio</h1>
      <Suspense>
        <Inner />
      </Suspense>
    </>
  );
}
