"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasRole, roleFromClaims } from "@/lib/auth/roles";

const TAB: Record<string, string> = {
  "/": "home",
  "/chi-siamo": "chi-siamo",
  "/servizi": "servizi",
  "/convenzioni": "convenzioni",
  "/dove-siamo": "dove-siamo",
  "/privacy": "privacy",
};

/** Staff-only shortcut. Client-only so the ISR HTML is the same for everyone. */
export function EditPageLink() {
  const path = usePathname();
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Anonymous visitors have no auth cookie: no Supabase code is even loaded.
    if (!/(^|;\s*)sb-[^=]*-auth-token/.test(document.cookie)) return;
    let live = true;
    void import("@/lib/supabase/client").then(async ({ createClient }) => {
      const { data } = await createClient().auth.getClaims();
      if (live) setShow(hasRole(roleFromClaims(data?.claims), "staff"));
    });
    return () => {
      live = false;
    };
  }, []);
  const tab = TAB[path];
  if (!show || !tab) return null;
  return (
    <p className="bg-bordeaux/10 px-4 py-2 text-center">
      Sei nello staff:{" "}
      <a
        href={`/gestione/sito?pagina=${tab}`}
        className="inline-flex min-h-11 items-center font-bold text-bordeaux underline"
      >
        Modifica questa pagina
      </a>
    </p>
  );
}
