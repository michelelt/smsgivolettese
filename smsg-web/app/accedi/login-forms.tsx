"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { loginSchema, magicLinkSchema } from "@/lib/auth/schemas";
import { safeNext } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

export function LoginForms({ next }: { next?: string }) {
  const [msg, setMsg] = useState<string>();
  const [err, setErr] = useState<string>();

  const login = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });
  const link = useForm<z.infer<typeof magicLinkSchema>>({
    resolver: zodResolver(magicLinkSchema),
  });

  const onLogin = login.handleSubmit(async (v) => {
    setErr(undefined);
    const { error } = await createClient().auth.signInWithPassword(v);
    if (error) return setErr("Email o password non corrette. Riprova.");
    window.location.assign(safeNext(next));
  });

  const onLink = link.handleSubmit(async (v) => {
    setErr(undefined);
    setMsg(undefined);
    const { error } = await createClient().auth.signInWithOtp({
      email: v.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
      },
    });
    // Same answer whether or not the account exists (no user enumeration).
    if (error && error.status !== 400)
      return setErr("Non riusciamo a inviare il link. Riprova più tardi.");
    setMsg(
      "Se l'indirizzo è registrato, ti abbiamo inviato un'email con il link per entrare.",
    );
  });

  return (
    <>
      <div aria-live="polite">
        {err && (
          <p
            role="alert"
            className="mt-4 rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux"
          >
            Attenzione: {err}
          </p>
        )}
        {msg && (
          <p
            role="status"
            className="mt-4 rounded-xl border-2 border-blu p-3 font-bold text-blu"
          >
            {msg}
          </p>
        )}
      </div>

      <form
        onSubmit={onLogin}
        noValidate
        aria-labelledby="t-pw"
        className="mt-6"
      >
        <h2 id="t-pw" className="text-2xl font-extrabold">
          Entra con la password
        </h2>
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          error={login.formState.errors.email?.message}
          {...login.register("email")}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          error={login.formState.errors.password?.message}
          {...login.register("password")}
        />
        <Button
          type="submit"
          className="mt-6"
          disabled={login.formState.isSubmitting}
        >
          Entra
        </Button>
      </form>

      <form
        onSubmit={onLink}
        noValidate
        aria-labelledby="t-ml"
        className="mt-10"
      >
        <h2 id="t-ml" className="text-2xl font-extrabold">
          Non ricordi la password?
        </h2>
        <p>Ti mandiamo per email un link per entrare, senza password.</p>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={link.formState.errors.email?.message}
          {...link.register("email")}
        />
        <Button
          type="submit"
          variant="secondary"
          className="mt-6"
          disabled={link.formState.isSubmitting}
        >
          Inviami il link
        </Button>
      </form>
    </>
  );
}
