"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError, Loading, Pill } from "@/components/ui/bits";
import { MoreActions } from "@/components/ui/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call, saveBlob } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { today } from "@/lib/dates";
import { formatEuro, centsToInput } from "@/lib/money";
import { BandDot, collectedCents, collectedInput } from "./price-band";
import { NO_HEALTH } from "./transport-form";

type Transport = components["schemas"]["Transport"];
type Candidate = components["schemas"]["Candidate"];

export const TRANSPORT_STATUS = {
  richiesto: "Da assegnare",
  assegnato: "Assegnato, in attesa di conferma",
  confermato: "Confermato dall'autista",
  svolto: "Svolto",
  annullato: "Annullato",
} as const;

const LABEL: Record<Candidate["status"], string> = {
  disponibile: "Disponibile",
  non_indicata: "Disponibilità non indicata",
  non_disponibile: "Non disponibile in quell'orario",
  gia_impegnato: "Già impegnato",
  assente: "Assente",
};

function AssignBody({ t, onClose }: { t: Transport; onClose: () => void }) {
  const toast = useToast();
  const [driver, setDriver] = useState(t.driverId ?? "");
  const [vehicle, setVehicle] = useState(t.vehicleId ?? "");
  const cands = useQuery({
    queryKey: ["transports", t.id, "candidates"],
    queryFn: () =>
      call(
        api.GET("/transports/{id}/candidates", {
          params: { path: { id: t.id } },
        }),
      ),
  });
  const vehicles = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => call(api.GET("/vehicles")),
  });
  const m = useMutation({
    meta: { inline: true },
    mutationFn: () =>
      call(
        api.POST("/transports/{id}/assign", {
          params: { path: { id: t.id } },
          body: { driverId: driver, vehicleId: vehicle || null },
        }),
      ),
    onSuccess: () => {
      toast("Autista assegnato: riceverà un'email");
      onClose();
    },
  });
  return (
    <>
      <Loading query={cands} />
      {cands.data?.items.length === 0 && (
        <p className="mt-3">Nessun autista abilitato disponibile.</p>
      )}
      <div role="radiogroup" aria-label="Autisti" className="mt-3">
        {cands.data?.items.map((c) => (
          <label
            key={c.volunteerId}
            className="flex min-h-12 items-center gap-3"
          >
            <input
              type="radio"
              name="driver"
              className="size-6 flex-none accent-bordeaux"
              disabled={!c.selectable}
              checked={driver === c.volunteerId}
              onChange={() => setDriver(c.volunteerId)}
            />
            <span>
              <span className="font-bold">
                {c.firstName} {c.lastName}
              </span>{" "}
              · {LABEL[c.status]} · {c.commitmentsInMonth} impegni nel mese
            </span>
          </label>
        ))}
      </div>
      <Select
        label="Mezzo"
        value={vehicle}
        onChange={(e) => setVehicle(e.target.value)}
      >
        <option value="">Nessun mezzo</option>
        {vehicles.data?.items
          .filter((v) => v.active)
          .map((v) => (
            <option
              key={v.id}
              value={v.id}
              disabled={t.wheelchair && !v.wheelchairAccessible}
            >
              {v.model} {v.plate}
              {v.wheelchairAccessible
                ? " (carrozzina)"
                : t.wheelchair
                  ? " (non adatto alla carrozzina)"
                  : ""}
            </option>
          ))}
      </Select>
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button
          auto
          disabled={!driver || m.isPending}
          onClick={() => m.mutate()}
        >
          Assegna
        </Button>
        <Button auto variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </>
  );
}

const km = z
  .string()
  .refine((v) => /^\d{1,7}$/.test(v.trim()), "scrivi un numero intero");
export const completeSchema = z
  .object({
    odometerStart: km,
    odometerEnd: km,
    driverNotes: z.string(),
    collected: collectedInput,
  })
  .refine(
    (v) =>
      Number(v.odometerEnd) >= Number(v.odometerStart) &&
      Number(v.odometerEnd) - Number(v.odometerStart) <= 2000,
    {
      path: ["odometerEnd"],
      message:
        "Controlla i chilometri: l'arrivo deve essere uguale o maggiore della partenza (al massimo 2000 km)",
    },
  );
export type CompleteValues = z.infer<typeof completeSchema>;

function CompleteBody({ t, onClose }: { t: Transport; onClose: () => void }) {
  const toast = useToast();
  const f = useForm<CompleteValues>({
    resolver: zodResolver(completeSchema),
    defaultValues: {
      odometerStart: t.odometerStart != null ? String(t.odometerStart) : "",
      odometerEnd: t.odometerEnd != null ? String(t.odometerEnd) : "",
      driverNotes: t.driverNotes ?? "",
      collected: "",
    },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: CompleteValues) =>
      call(
        api.POST("/transports/{id}/complete", {
          params: { path: { id: t.id } },
          body: {
            odometerStart: Number(v.odometerStart),
            odometerEnd: Number(v.odometerEnd),
            driverNotes: v.driverNotes.trim() || null,
            collectedCents: collectedCents(v.collected),
          },
        }),
      ),
    onSuccess: () => {
      toast("Trasporto chiuso");
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} noValidate>
      <Field
        label="Chilometri del contachilometri alla partenza"
        inputMode="numeric"
        {...f.register("odometerStart")}
        error={e.odometerStart?.message}
      />
      <Field
        label="Chilometri del contachilometri all'arrivo"
        inputMode="numeric"
        {...f.register("odometerEnd")}
        error={e.odometerEnd?.message}
      />
      <Field
        label="Importo incassato dall'autista (euro)"
        hint="Lascia vuoto se non ha incassato."
        inputMode="decimal"
        autoComplete="off"
        {...f.register("collected")}
        error={e.collected?.message}
      />
      <Textarea
        label="Note dell'autista (facoltative)"
        hint={NO_HEALTH}
        maxLength={500}
        {...f.register("driverNotes")}
      />
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending}>
          Chiudi il trasporto
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Indietro
        </Button>
      </DialogActions>
    </form>
  );
}

function CollectedBody({ t, onClose }: { t: Transport; onClose: () => void }) {
  const toast = useToast();
  const f = useForm<{ collected: string }>({
    resolver: zodResolver(z.object({ collected: collectedInput })),
    defaultValues: {
      collected: t.collectedCents != null ? centsToInput(t.collectedCents) : "",
    },
  });
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: { collected: string }) =>
      call(
        api.PUT("/transports/{id}/collected", {
          params: { path: { id: t.id } },
          body: { collectedCents: collectedCents(v.collected) },
        }),
      ),
    onSuccess: () => {
      toast("Incassato salvato");
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} noValidate>
      <Field
        label="Importo incassato (euro)"
        hint="Lascia vuoto se non è stato incassato."
        inputMode="decimal"
        autoComplete="off"
        {...f.register("collected")}
        error={f.formState.errors.collected?.message}
      />
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending}>
          Salva
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Indietro
        </Button>
      </DialogActions>
    </form>
  );
}

export function TransportPanel({ t }: { t: Transport }) {
  const toast = useToast();
  const [dlg, setDlg] = useState<
    "assign" | "cancel" | "complete" | "collected" | null
  >(null);
  const close = () => setDlg(null);
  const unassign = useMutation({
    mutationFn: () =>
      call(
        api.POST("/transports/{id}/unassign", {
          params: { path: { id: t.id } },
        }),
      ),
    onSuccess: () =>
      toast("Autista tolto: il trasporto è di nuovo da assegnare"),
  });
  const cancel = useMutation({
    meta: { inline: true },
    mutationFn: () =>
      call(
        api.POST("/transports/{id}/cancel", { params: { path: { id: t.id } } }),
      ),
    onSuccess: () => {
      toast("Trasporto annullato");
      close();
    },
  });
  const pdf = useMutation({
    mutationFn: () =>
      saveBlob(
        api.GET("/transports/{id}/sheet.pdf", {
          params: { path: { id: t.id } },
          parseAs: "blob",
        }),
        `foglio-viaggio-${t.travelDate}.pdf`,
      ),
    onSuccess: () => toast("Foglio di viaggio scaricato"),
  });
  const proforma = useMutation({
    mutationFn: () =>
      saveBlob(
        api.GET("/transports/{id}/proforma.pdf", {
          params: { path: { id: t.id } },
          parseAs: "blob",
        }),
        `riepilogo-servizio-${t.travelDate}.pdf`,
      ),
    onSuccess: () => toast("Pro forma scaricato"),
  });
  const live =
    t.status === "richiesto" ||
    t.status === "assegnato" ||
    t.status === "confermato";
  const open = t.status === "assegnato" || t.status === "confermato";
  const canClose = open && t.travelDate <= today();
  const hasSheet = !!t.driverId && t.status !== "annullato";
  return (
    <section
      aria-labelledby="stato"
      className="mt-6 rounded-xl border-2 border-blu p-4"
    >
      <h2 id="stato" className="text-2xl font-extrabold text-blu">
        Stato
      </h2>
      <p className="mt-2">
        <Pill>{TRANSPORT_STATUS[t.status]}</Pill>
      </p>
      <p className="mt-2">
        Autista: {t.driverName ?? "—"} · Mezzo: {t.vehiclePlate ?? "—"}
        {t.status === "svolto" &&
          ` · Km: ${t.km ?? "—"} (contachilometri ${t.odometerStart ?? "—"} → ${t.odometerEnd ?? "—"})`}
      </p>
      {t.status === "svolto" && (
        <p>
          Fascia:{" "}
          {t.bandColor ? (
            <BandDot color={t.bandColor} label={t.bandLabel} />
          ) : (
            "—"
          )}
          {t.bandPriceCents != null &&
            ` · Prezzo fascia ${formatEuro(t.bandPriceCents)}`}
          {" · Incassato: "}
          <b>
            {t.collectedCents != null
              ? formatEuro(t.collectedCents)
              : "non incassato"}
          </b>
        </p>
      )}
      {t.driverNotes && <p>Note dell&apos;autista: {t.driverNotes}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {t.status === "richiesto" && (
          <Button auto onClick={() => setDlg("assign")}>
            Assegna autista
          </Button>
        )}
        {open && (
          <Button
            auto
            variant={canClose ? "primary" : "secondary"}
            onClick={() => setDlg(canClose ? "complete" : "assign")}
          >
            {canClose ? "Chiudi con i km" : "Cambia autista"}
          </Button>
        )}
        {open && canClose && (
          <Button auto variant="secondary" onClick={() => setDlg("assign")}>
            Cambia autista
          </Button>
        )}
        {t.status === "svolto" && (
          <>
            <Button
              auto
              disabled={proforma.isPending}
              onClick={() => proforma.mutate()}
            >
              Pro forma (PDF)
            </Button>
            <Button
              auto
              variant="secondary"
              onClick={() => setDlg("collected")}
            >
              Modifica incassato
            </Button>
          </>
        )}
        {(live || hasSheet) && (
          <MoreActions>
            {open && (
              <Button
                variant="secondary"
                disabled={unassign.isPending}
                onClick={() => unassign.mutate()}
              >
                Togli l&apos;autista
              </Button>
            )}
            {hasSheet && (
              <Button
                variant="secondary"
                disabled={pdf.isPending}
                onClick={() => pdf.mutate()}
              >
                Foglio di viaggio (PDF)
              </Button>
            )}
            {live && (
              <Button variant="danger" onClick={() => setDlg("cancel")}>
                Annulla trasporto
              </Button>
            )}
          </MoreActions>
        )}
      </div>
      {open && t.travelDate > today() && (
        <p className="mt-2">Si può chiudere dal giorno del viaggio.</p>
      )}
      <Dialog open={dlg === "assign"} onClose={close} title="Assegna autista">
        <AssignBody t={t} onClose={close} />
      </Dialog>
      <Dialog
        open={dlg === "complete"}
        onClose={close}
        title="Chiudi il trasporto"
      >
        <CompleteBody t={t} onClose={close} />
      </Dialog>
      <Dialog
        open={dlg === "collected"}
        onClose={close}
        title="Importo incassato"
      >
        <CollectedBody t={t} onClose={close} />
      </Dialog>
      <ConfirmDialog
        open={dlg === "cancel"}
        onClose={() => {
          close();
          cancel.reset();
        }}
        title="Annullare il trasporto?"
        confirmLabel="Annulla trasporto"
        pending={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={() => cancel.mutate()}
      >
        <p>L&apos;autista, se assegnato, riceve un&apos;email.</p>
      </ConfirmDialog>
    </section>
  );
}
