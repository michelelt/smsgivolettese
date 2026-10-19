"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/bits";
import { useToast } from "@/components/ui/toast";
import { anonymizeMember, anonymizeUser, exportData } from "@/lib/api/admin";
import { roleFromClaims } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

/** True once the session says super_admin (the API enforces it anyway). */
export function useIsSuperAdmin() {
  const [yes, setYes] = useState(false);
  useEffect(() => {
    void createClient()
      .auth.getClaims()
      .then(({ data }) =>
        setYes(roleFromClaims(data?.claims) === "super_admin"),
      );
  }, []);
  return yes;
}

type Retained = { id: string; year: number; number: number }[];

/** "Esporta dati" + "Anonimizza" (ADR-067). Anonymising needs the word ANONIMIZZA typed. */
export function GdprActions({
  subject,
  id,
  name,
  canAnonymize = true,
  anonymized = false,
  disabledReason,
  onDone,
}: {
  subject: "member" | "user";
  id: string;
  name: string;
  canAnonymize?: boolean;
  anonymized?: boolean;
  disabledReason?: string;
  onDone?: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [retained, setRetained] = useState<Retained>();
  const exp = useMutation({
    meta: { inline: true },
    mutationFn: () => exportData(subject, id),
    onSuccess: () => toast("Dati esportati: controlla i download"),
    onError: (e) => toast(e.message, true),
  });
  const anon = useMutation({
    meta: { inline: true },
    mutationFn: () =>
      subject === "member" ? anonymizeMember(id) : anonymizeUser(id),
    onSuccess: (r) => {
      setRetained(r.retainedInvoices);
      onDone?.();
    },
  });
  const close = () => {
    setOpen(false);
    setTyped("");
    setRetained(undefined);
    anon.reset();
  };
  return (
    <>
      <Button
        variant="secondary"
        disabled={exp.isPending}
        aria-label={`Esporta dati di ${name}`}
        onClick={() => exp.mutate()}
      >
        Esporta dati
      </Button>
      {!anonymized && (
        <Button
          variant="danger"
          disabled={!canAnonymize}
          aria-label={`Anonimizza ${name}`}
          onClick={() => setOpen(true)}
        >
          Anonimizza
        </Button>
      )}
      {disabledReason && !canAnonymize && (
        <span className="text-base">{disabledReason}</span>
      )}
      <Dialog open={open} onClose={close} title={`Anonimizza ${name}`}>
        {retained ? (
          <>
            <p role="status" className="mt-3 font-bold">
              Anonimizzazione completata.
            </p>
            {retained.length > 0 && (
              <>
                <p className="mt-2">
                  Queste fatture restano conservate per obbligo di legge:
                </p>
                <ul className="mt-1 list-disc pl-6">
                  {retained.map((i) => (
                    <li key={i.id}>
                      Fattura {i.number}/{i.year}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <DialogActions>
              <Button auto onClick={close}>
                Chiudi
              </Button>
            </DialogActions>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed === "ANONIMIZZA") anon.mutate();
            }}
          >
            <p className="mt-3">
              I dati personali vengono cancellati e{" "}
              <b>non si può tornare indietro</b>. Le fatture già emesse restano
              conservate.
            </p>
            <label
              htmlFor="conferma-anonimizza"
              className="mt-4 block font-bold"
            >
              Per confermare scrivi ANONIMIZZA
            </label>
            <input
              id="conferma-anonimizza"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-ink bg-white px-3 text-lg"
            />
            <FormError message={anon.error?.message} />
            <DialogActions>
              <Button
                auto
                type="submit"
                variant="danger"
                disabled={typed !== "ANONIMIZZA" || anon.isPending}
              >
                Anonimizza per sempre
              </Button>
              <Button auto type="button" variant="secondary" onClick={close}>
                Annulla
              </Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </>
  );
}
