import type { Metadata } from "next";
import { ProposalForm } from "@/components/public/proposal-form";
import { SimplePage } from "@/components/public/page-bodies";
import { parseEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Proponi una notizia",
  description: "Hai una notizia, un avviso o un evento? Scrivicelo.",
  alternates: { canonical: "/proponi" },
};

export default function Proponi() {
  return (
    <SimplePage
      title="Proponi una notizia"
      intro={
        <p>
          Compila il modulo: il nostro staff leggerà la proposta prima di
          pubblicarla.
        </p>
      }
    >
      <ProposalForm
        siteKey={parseEnv(process.env).NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      />
    </SimplePage>
  );
}
