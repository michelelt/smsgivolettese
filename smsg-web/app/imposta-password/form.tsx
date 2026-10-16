"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { setPasswordSchema } from "@/lib/auth/schemas";
import { roleFromClaims } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const [err, setErr] = useState<string>();
  const form = useForm<z.infer<typeof setPasswordSchema>>({
    resolver: zodResolver(setPasswordSchema),
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    setErr(undefined);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: v.password,
    });
    if (error)
      return setErr(
        "Non è stato possibile salvare la password. Riprova o richiedi un nuovo link.",
      );
    // Staff/super_admin cannot refresh a link-born session: send them to sign in with the password.
    const { data } = await supabase.auth.getClaims();
    if (roleFromClaims(data?.claims) !== "volontario") {
      await supabase.auth.signOut();
      window.location.assign("/accedi?impostata=1");
      return;
    }
    // Full reload so the server sees the new cookies.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/gestione");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      {err && (
        <p
          role="alert"
          className="rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux"
        >
          Attenzione: {err}
        </p>
      )}
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
  );
}
