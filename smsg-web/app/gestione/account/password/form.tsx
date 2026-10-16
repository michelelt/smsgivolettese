"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { changePasswordSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string>();
  const [done, setDone] = useState(false);
  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
  });
  const { errors, isSubmitting } = form.formState;

  async function sendCode() {
    setErr(undefined);
    setSending(true);
    const { error } = await createClient().auth.reauthenticate();
    setSending(false);
    if (error)
      return setErr("Non riusciamo a inviare il codice. Riprova più tardi.");
    setSent(true);
  }

  const onSubmit = form.handleSubmit(async (v) => {
    setErr(undefined);
    const { error } = await createClient().auth.updateUser({
      password: v.password,
      nonce: v.nonce,
    });
    if (error)
      return setErr(
        "Codice non valido o scaduto, oppure password non accettata. Riprova.",
      );
    form.reset();
    setSent(false);
    setDone(true);
  });

  return (
    <div className="mt-4">
      {err && (
        <p
          role="alert"
          className="mb-4 rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux"
        >
          Attenzione: {err}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="mb-4 rounded-xl border-2 border-blu p-3 font-bold text-blu"
        >
          La password è stata cambiata.
        </p>
      )}
      {!sent ? (
        <>
          <p>
            Per sicurezza ti mandiamo per email un codice da scrivere qui sotto.
          </p>
          <Button
            type="button"
            className="mt-6"
            onClick={sendCode}
            disabled={sending}
          >
            Inviami il codice per email
          </Button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate aria-label="Cambia password">
          <p role="status">Ti abbiamo inviato un codice per email.</p>
          <Field
            label="Codice ricevuto per email"
            autoComplete="one-time-code"
            error={errors.nonce?.message}
            {...form.register("nonce")}
          />
          <Field
            label="Nuova password"
            type="password"
            autoComplete="new-password"
            hint="Almeno 12 caratteri."
            error={errors.password?.message}
            {...form.register("password")}
          />
          <Field
            label="Ripeti la password"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...form.register("confirm")}
          />
          <Button type="submit" className="mt-6" disabled={isSubmitting}>
            Salva la password
          </Button>
        </form>
      )}
    </div>
  );
}
