"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { safeNext } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "scriva le 6 cifre che vede nell'app"),
});
type Factor = { id: string; friendly_name?: string; created_at: string };
type Enrol = { id: string; qr: string; secret: string };

const alert =
  "mt-4 rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux";

export function SecurityPanel({ next }: { next?: string }) {
  const mfa = createClient().auth.mfa;
  const [factors, setFactors] = useState<Factor[]>();
  const [aal2, setAal2] = useState(false);
  const [enrol, setEnrol] = useState<Enrol>();
  const [removing, setRemoving] = useState<Factor>();
  const [err, setErr] = useState<string>();
  const [ok, setOk] = useState<string>();
  const f = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const load = useCallback(async () => {
    const [{ data: l }, { data: a }] = await Promise.all([
      mfa.listFactors(),
      mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setFactors(l?.totp ?? []);
    setAal2(a?.currentLevel === "aal2");
  }, [mfa]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of external auth state
    void load();
  }, [load]);

  async function start() {
    setErr(undefined);
    setOk(undefined);
    // A half-finished earlier attempt would block a new one with the same name.
    const { data: all } = await mfa.listFactors();
    for (const x of all?.all ?? [])
      if (x.status === "unverified") await mfa.unenroll({ factorId: x.id });
    const { data, error } = await mfa.enroll({
      factorType: "totp",
      friendlyName: `App ${new Date().toISOString().slice(0, 16)}`,
    });
    if (error || !data)
      return setErr("Non riusciamo ad avviare la configurazione. Riprova.");
    setEnrol({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  const confirm = f.handleSubmit(async ({ code }) => {
    if (!enrol) return;
    setErr(undefined);
    const { error } = await mfa.challengeAndVerify({
      factorId: enrol.id,
      code,
    });
    if (error)
      return setErr(
        "Codice non corretto o scaduto. Riprova con il codice nuovo.",
      );
    f.reset();
    setEnrol(undefined);
    await load();
    if (next) return window.location.assign(safeNext(next));
    setOk(
      "App di autenticazione attivata. Da ora, dopo la password, le chiederemo il codice.",
    );
  });

  async function remove() {
    if (!removing) return;
    const { error } = await mfa.unenroll({ factorId: removing.id });
    setRemoving(undefined);
    if (error)
      return setErr(
        "Non riusciamo a rimuoverla. Prima inserisca il codice dell'app, poi riprovi.",
      );
    setOk("App rimossa.");
    await load();
  }

  if (!factors) return <p className="mt-4">Caricamento…</p>;
  return (
    <div className="mt-4 max-w-2xl">
      {next && (
        <p
          role="status"
          className="rounded-xl border-2 border-blu p-3 font-bold text-blu"
        >
          Per questa sezione serve il codice dell&apos;app di autenticazione.
          {factors.length === 0
            ? " Configuri prima l'app qui sotto."
            : " Inserisca il codice per continuare."}
        </p>
      )}
      {err && (
        <p role="alert" className={alert}>
          Attenzione: {err}
        </p>
      )}
      {ok && (
        <p
          role="status"
          className="mt-4 rounded-xl border-2 border-blu p-3 font-bold text-blu"
        >
          {ok}
        </p>
      )}

      <h2 className="mt-6 text-2xl font-extrabold text-bordeaux">
        App di autenticazione
      </h2>
      <p className="mt-2">
        Una seconda protezione: oltre alla password serve un codice di 6 cifre
        che cambia ogni 30 secondi, mostrato da un&apos;app sul telefono.
        Consigliamo di configurare due dispositivi, perché se si perde il
        telefono non ci sono codici di recupero.
      </p>

      {factors.length === 0 && (
        <p className="mt-4 font-bold">Nessuna app configurata.</p>
      )}
      <ul className="mt-4 space-y-3">
        {factors.map((x) => (
          <li
            key={x.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink p-4"
          >
            <span>
              <b>{x.friendly_name ?? "App di autenticazione"}</b>
              <br />
              Attivata il {new Date(x.created_at).toLocaleDateString("it-IT")}
            </span>
            <Button
              auto
              variant="danger"
              aria-label={`Rimuovi ${x.friendly_name ?? "app di autenticazione"}`}
              onClick={() => setRemoving(x)}
            >
              Rimuovi
            </Button>
          </li>
        ))}
      </ul>

      {factors.length > 0 && !aal2 && (
        <p className="mt-4">
          <ButtonLink
            variant="secondary"
            href={`/accedi/verifica?next=${encodeURIComponent(next ? safeNext(next) : "/gestione/account/sicurezza")}`}
          >
            Inserisci il codice
          </ButtonLink>
        </p>
      )}

      {enrol ? (
        <form
          onSubmit={confirm}
          noValidate
          aria-labelledby="t-enrol"
          className="mt-6"
        >
          <h3 id="t-enrol" className="text-xl font-extrabold">
            Configura una nuova app
          </h3>
          <ol className="mt-2 list-decimal space-y-2 pl-6">
            <li>
              Apra l&apos;app di autenticazione sul telefono e scelga di
              aggiungere un account.
            </li>
            <li>
              Inquadri questo disegno oppure scriva a mano la chiave qui sotto.
              {/* eslint-disable-next-line @next/next/no-img-element -- data: SVG from Auth */}
              <img
                src={enrol.qr}
                alt="Codice QR da inquadrare con l'app di autenticazione"
                width={200}
                height={200}
                className="mt-2 border-2 border-ink bg-white p-2"
              />
              <p className="mt-2">
                Chiave:{" "}
                <code className="break-all font-bold">{enrol.secret}</code>
              </p>
            </li>
            <li>Scriva qui il codice di 6 cifre mostrato dall&apos;app.</li>
          </ol>
          <Field
            label="Codice a 6 cifre"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={f.formState.errors.code?.message}
            {...f.register("code")}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Button auto type="submit" disabled={f.formState.isSubmitting}>
              Attiva
            </Button>
            <Button
              auto
              type="button"
              variant="secondary"
              onClick={() => {
                void mfa.unenroll({ factorId: enrol.id });
                setEnrol(undefined);
              }}
            >
              Annulla
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-6">
          <Button auto onClick={() => void start()}>
            {factors.length
              ? "Aggiungi un altro dispositivo"
              : "Configura l'app"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(undefined)}
        title="Rimuovere l'app?"
        confirmLabel="Rimuovi"
        onConfirm={() => void remove()}
      >
        Dopo averla rimossa, se non ha un&apos;altra app configurata, potrà
        entrare solo con la password.
      </ConfirmDialog>
    </div>
  );
}
