"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/bits";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call, saveBlob } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { METHODS } from "@/lib/forms";

type Invoice = components["schemas"]["Invoice"];
type Method = components["schemas"]["InvoicePay"]["method"];

function PayBody({ i, onClose }: { i: Invoice; onClose: () => void }) {
  const toast = useToast();
  const { register, handleSubmit } = useForm<{ method: Method }>({
    defaultValues: { method: "contanti" },
  });
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: { method: Method }) =>
      call(
        api.POST("/invoices/{id}/pay", {
          params: { path: { id: i.id } },
          body: v,
        }),
      ),
    onSuccess: () => {
      toast(`Fattura n. ${i.number}/${i.year} segnata come pagata`);
      onClose();
    },
  });
  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))}>
      <Select label="Come ha pagato?" {...register("method")}>
        {METHODS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending}>
          Segna pagata
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Indietro
        </Button>
      </DialogActions>
    </form>
  );
}

function VoidBody({ i, onClose }: { i: Invoice; onClose: () => void }) {
  const toast = useToast();
  const { register, handleSubmit, formState } = useForm<{ reason: string }>();
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: { reason: string }) =>
      call(
        api.POST("/invoices/{id}/void", {
          params: { path: { id: i.id } },
          body: { reason: v.reason.trim() },
        }),
      ),
    onSuccess: () => {
      toast(
        `Fattura n. ${i.number}/${i.year} annullata. Le prestazioni si possono fatturare di nuovo.`,
      );
      onClose();
    },
  });
  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} noValidate>
      <p className="mt-3">
        Il numero resta occupato. Se la fattura è già stata trasmessa, va emessa
        anche una nota di credito dal gestionale.
      </p>
      <Textarea
        label="Motivo dell'annullamento"
        {...register("reason", {
          validate: (v) => v.trim().length > 0 || "scriva il motivo",
        })}
        error={formState.errors.reason?.message}
      />
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" variant="danger" disabled={m.isPending}>
          Annulla fattura
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Indietro
        </Button>
      </DialogActions>
    </form>
  );
}

export function InvoiceActions({ invoice: i }: { invoice: Invoice }) {
  const toast = useToast();
  const [dlg, setDlg] = useState<"pay" | "void" | null>(null);
  const close = () => setDlg(null);
  const pdf = useMutation({
    mutationFn: () =>
      saveBlob(
        api.GET("/invoices/{id}/pdf", {
          params: { path: { id: i.id } },
          parseAs: "blob",
        }),
        `fattura-${i.number}-${i.year}.pdf`,
      ),
    onSuccess: () => toast("Fattura scaricata"),
  });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {i.status === "emessa" && (
        <Button auto onClick={() => setDlg("pay")}>
          Segna pagata
        </Button>
      )}
      <Button
        auto
        variant="secondary"
        disabled={pdf.isPending}
        onClick={() => pdf.mutate()}
      >
        Scarica PDF
      </Button>
      {i.status !== "annullata" && (
        <Button auto variant="danger" onClick={() => setDlg("void")}>
          Annulla
        </Button>
      )}
      <Dialog
        open={dlg === "pay"}
        onClose={close}
        title={`Fattura n. ${i.number}/${i.year} pagata`}
      >
        <PayBody i={i} onClose={close} />
      </Dialog>
      <Dialog
        open={dlg === "void"}
        onClose={close}
        title={`Annullare la fattura n. ${i.number}/${i.year}?`}
      >
        <VoidBody i={i} onClose={close} />
      </Dialog>
    </div>
  );
}
