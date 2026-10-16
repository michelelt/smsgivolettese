"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Turnstile } from "@/components/public/turnstile";
import type { PublicService } from "@/components/public/service-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import {
  bookingDays,
  bookingErrorMessage,
  bookingFormSchema,
  eur,
  formatDay,
  SLOTS,
  type BookingForm,
} from "@/lib/public/booking";

type Slot = keyof typeof SLOTS;
const NAMES = ["Servizio", "Giorno", "I suoi dati", "Conferma"];
const EMPTY: BookingForm = {
  firstName: "",
  lastName: "",
  phone: "",
  declaredMember: "si",
  notes: "",
};

export function BookingWizard({
  services,
  phone,
  siteKey,
}: {
  services: PublicService[];
  phone: string | null;
  siteKey: string;
}) {
  const preset = useSearchParams().get("servizio");
  const presetOk = services.some((s) => s.id === preset);
  const [step, setStep] = useState(presetOk ? 2 : 1);
  const [serviceId, setServiceId] = useState(presetOk ? preset : null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot>("mattina");
  const [data, setData] = useState<BookingForm>(EMPTY);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const days = useMemo(() => (step === 2 ? bookingDays() : []), [step]);
  const service = services.find((s) => s.id === serviceId);

  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else heading.current?.focus();
  }, [step]);

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: data,
  });

  if (services.length === 0)
    return (
      <p className="rounded-2xl border-2 border-bordeaux p-5 text-xl">
        Non ci sono servizi prenotabili online in questo momento.
        {phone && (
          <>
            {" "}
            Ci chiami al <b>{phone}</b>.
          </>
        )}
      </p>
    );

  async function send() {
    if (!service || !day) return;
    if (!token) {
      setError(
        "Attenda un istante che la verifica di sicurezza sia completata, poi riprovi.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { response, error: err } = await api.POST("/public/bookings", {
        body: {
          serviceId: service.id,
          day,
          slot,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: data.phone,
          declaredMember: data.declaredMember === "si",
          ...(data.notes.trim() ? { notes: data.notes.trim() } : {}),
          turnstileToken: token,
        },
      });
      if (response.ok) return setStep(5);
      const code = (err as { error?: { code?: string } } | undefined)?.error
        ?.code;
      setError(bookingErrorMessage(code, phone ?? undefined));
    } catch {
      setError(bookingErrorMessage(undefined, phone ?? undefined));
    } finally {
      setBusy(false);
      setToken("");
      setResetKey((k) => k + 1); // tokens are single use
    }
  }

  const h2 = "text-3xl font-extrabold outline-none";
  const nav = "mt-6 flex flex-wrap justify-between gap-3";
  const back = (to: number) => (
    <Button
      type="button"
      variant="secondary"
      className="sm:w-auto"
      onClick={() => {
        setError("");
        setStep(to);
      }}
    >
      <Icon name="back" /> Indietro
    </Button>
  );
  const choice =
    "flex min-h-14 items-center gap-3 rounded-xl border-2 border-ink bg-white px-4 font-bold";
  const pressed =
    "aria-pressed:border-bordeaux aria-pressed:bg-bordeaux aria-pressed:text-white aria-pressed:underline";

  return (
    <div>
      {step < 5 && (
        <ol
          aria-label="Passaggi"
          className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {NAMES.map((n, i) => (
            <li
              key={n}
              aria-current={i + 1 === step ? "step" : undefined}
              className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 font-bold ${i + 1 === step ? "border-bordeaux bg-white" : "border-ink/40"}`}
            >
              <b
                aria-hidden="true"
                className="grid size-8 flex-none place-items-center rounded-full bg-blu text-white"
              >
                {i + 1 < step ? "✓" : i + 1}
              </b>
              <span>
                <span className="sr-only">
                  Passo {i + 1}
                  {i + 1 < step
                    ? " completato"
                    : i + 1 === step
                      ? " in corso"
                      : ""}
                  :{" "}
                </span>
                {n}
              </span>
            </li>
          ))}
        </ol>
      )}

      {step === 1 && (
        <section>
          <h2 ref={heading} tabIndex={-1} className={h2}>
            Quale servizio le serve?
          </h2>
          <div className="mt-4 grid gap-3">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={serviceId === s.id}
                onClick={() => setServiceId(s.id)}
                className={`${choice} ${pressed} flex-col items-start justify-center py-2 text-left`}
              >
                <span className="text-xl">{s.name}</span>
                <span className="font-normal">
                  {s.scheduleNote && `${s.scheduleNote} · `}soci{" "}
                  {eur(s.memberPriceCents)}
                </span>
              </button>
            ))}
          </div>
          <div className={nav}>
            <span />
            <Button
              type="button"
              className="sm:w-auto"
              disabled={!serviceId}
              onClick={() => setStep(2)}
            >
              Avanti <Icon name="next" />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 ref={heading} tabIndex={-1} className={h2}>
            Che giorno preferisce?
          </h2>
          <p className="mt-2">
            Servizio scelto: <b>{service?.name}</b>. L&apos;orario preciso
            glielo diciamo noi per telefono.
          </p>
          <div
            role="group"
            aria-label="Giorni disponibili"
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {days.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={day === d}
                onClick={() => setDay(d)}
                className={`${choice} ${pressed} justify-center text-center capitalize`}
              >
                {formatDay(d)}
              </button>
            ))}
          </div>
          <fieldset className="mt-6">
            <legend className="font-bold">Mattina o pomeriggio?</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {(Object.keys(SLOTS) as Slot[]).map((k) => (
                <label key={k} className={choice}>
                  <input
                    type="radio"
                    name="slot"
                    className="size-6 accent-bordeaux"
                    checked={slot === k}
                    onChange={() => setSlot(k)}
                  />
                  {SLOTS[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className={nav}>
            {back(1)}
            <Button
              type="button"
              className="sm:w-auto"
              disabled={!day}
              onClick={() => setStep(3)}
            >
              Avanti <Icon name="next" />
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 ref={heading} tabIndex={-1} className={h2}>
            I suoi dati
          </h2>
          <p className="mt-2">
            Servono solo per richiamarla e confermare l&apos;orario.
          </p>
          <form
            aria-label="I suoi dati"
            noValidate
            onSubmit={form.handleSubmit((v) => {
              setData(v);
              setStep(4);
            })}
          >
            <Field
              label="Nome"
              autoComplete="given-name"
              error={form.formState.errors.firstName?.message}
              {...form.register("firstName")}
            />
            <Field
              label="Cognome"
              autoComplete="family-name"
              error={form.formState.errors.lastName?.message}
              {...form.register("lastName")}
            />
            <Field
              label="Telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              hint="Ad esempio 333 1234567"
              error={form.formState.errors.phone?.message}
              {...form.register("phone")}
            />
            <fieldset className="mt-4">
              <legend className="font-bold">È socio della SMS?</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {[
                  ["si", "Sì, sono socio"],
                  ["no", "No"],
                ].map(([v, l]) => (
                  <label key={v} className={choice}>
                    <input
                      type="radio"
                      value={v}
                      className="size-6 accent-bordeaux"
                      {...form.register("declaredMember")}
                    />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <Textarea
              label="Note"
              hint="Facoltativo: chi l'accompagna, come contattarla. Non scriva informazioni sulla salute."
              maxLength={600}
              error={form.formState.errors.notes?.message}
              {...form.register("notes")}
            />
            <div className={nav}>
              {back(2)}
              <Button type="submit" className="sm:w-auto">
                Avanti <Icon name="next" />
              </Button>
            </div>
          </form>
        </section>
      )}

      {step === 4 && service && day && (
        <section>
          <h2 ref={heading} tabIndex={-1} className={h2}>
            Controlli e confermi
          </h2>
          <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-2xl border-2 border-ink bg-white p-5 text-xl">
            <dt className="font-bold">Servizio</dt>
            <dd>{service.name}</dd>
            <dt className="font-bold">Giorno</dt>
            <dd className="capitalize">
              {formatDay(day, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </dd>
            <dt className="font-bold">Fascia</dt>
            <dd>{SLOTS[slot]}</dd>
            <dt className="font-bold">Nome</dt>
            <dd>
              {data.firstName} {data.lastName}
            </dd>
            <dt className="font-bold">Telefono</dt>
            <dd>{data.phone}</dd>
            <dt className="font-bold">Socio</dt>
            <dd>{data.declaredMember === "si" ? "Sì" : "No"}</dd>
            <dt className="font-bold">Prezzo</dt>
            <dd>
              {eur(
                data.declaredMember === "si"
                  ? service.memberPriceCents
                  : service.nonMemberPriceCents,
              )}
            </dd>
            {data.notes.trim() && (
              <>
                <dt className="font-bold">Note</dt>
                <dd>{data.notes}</dd>
              </>
            )}
          </dl>
          <div className="mt-4">
            <Turnstile
              siteKey={siteKey}
              onToken={setToken}
              resetKey={resetKey}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux"
            >
              Attenzione: {error}
            </p>
          )}
          <p className="mt-4">
            Confermando, i suoi dati saranno usati solo per richiamarla e
            gestire la prenotazione.{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener"
              className="font-bold text-blu underline"
            >
              Leggi l&apos;informativa sulla privacy (si apre in una nuova
              scheda)
            </Link>
            .
          </p>
          <div className={nav}>
            {back(3)}
            <Button
              type="button"
              className="sm:w-auto"
              disabled={busy}
              onClick={send}
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="check" />{" "}
                {busy ? "Invio in corso…" : "Conferma la prenotazione"}
              </span>
            </Button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="rounded-2xl border-4 border-blu p-6">
          <h2
            ref={heading}
            tabIndex={-1}
            className={`${h2} flex items-center gap-3 text-blu`}
          >
            <Icon name="check" /> Richiesta inviata
          </h2>
          <p className="mt-3 text-xl" role="status">
            La richiameremo al <b>{data.phone}</b> per confermare l&apos;orario.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              className="sm:w-auto"
              onClick={() => {
                setServiceId(null);
                setDay(null);
                setSlot("mattina");
                setToken("");
                setStep(1);
              }}
            >
              Prenota un altro servizio
            </Button>
            <ButtonLink href="/" variant="secondary">
              Torna alla home
            </ButtonLink>
          </div>
        </section>
      )}
    </div>
  );
}
