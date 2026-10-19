"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { safeNext } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "scrivi le 6 cifre che vedi nell'app"),
});

export function VerifyForm({ next }: { next?: string }) {
  const [err, setErr] = useState<string>();
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = f.handleSubmit(async ({ code }) => {
    setErr(undefined);
    const mfa = createClient().auth.mfa;
    const { data: list } = await mfa.listFactors();
    const factor = list?.totp[0]; // `totp` holds verified factors only
    if (!factor)
      return setErr(
        "Nessuna app di autenticazione configurata per questo account.",
      );
    const { error } = await mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });
    if (error)
      return setErr(
        "Codice non corretto o scaduto. Riprova con il codice nuovo.",
      );
    window.location.assign(safeNext(next));
  });
  return (
    <form onSubmit={onSubmit} noValidate className="mt-4">
      <p>
        Apri l&apos;app di autenticazione sul telefono e scrivi il codice di 6
        cifre.
      </p>
      {err && (
        <p
          role="alert"
          className="mt-4 rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux"
        >
          Attenzione: {err}
        </p>
      )}
      <Field
        label="Codice a 6 cifre"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        error={f.formState.errors.code?.message}
        {...f.register("code")}
      />
      <Button
        type="submit"
        className="mt-6"
        disabled={f.formState.isSubmitting}
      >
        Conferma
      </Button>
    </form>
  );
}
