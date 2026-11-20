"use client";

import { MemberAddHeader } from "@/components/gestione/member-add-tabs";
import { MemberForm } from "@/components/gestione/member-form";

export default function NuovoSocio() {
  return (
    <>
      <MemberAddHeader current="/gestione/soci/nuovo" />
      <MemberForm />
    </>
  );
}
