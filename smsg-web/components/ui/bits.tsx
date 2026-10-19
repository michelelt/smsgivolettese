"use client";

import { Button } from "./button";

/** Server/validation message for a form, announced when it appears. */
export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-4 font-bold text-bordeaux">
      Attenzione: {message}
    </p>
  ) : null;
}

/** Soft tax-code warning (ADR-048): the staff member decides. */
export function TaxWarning({
  message,
  onForce,
  disabled,
}: {
  message: string;
  onForce: () => void;
  disabled?: boolean;
}) {
  return (
    <div role="alert" className="mt-4 rounded-xl border-2 border-bordeaux p-3">
      <p className="font-bold text-bordeaux">Attenzione: {message}</p>
      <p>Controlla il codice fiscale. Se è corretto, puoi salvare lo stesso.</p>
      <Button
        type="button"
        auto
        variant="danger"
        className="mt-2"
        onClick={onForce}
        disabled={disabled}
      >
        Salva comunque
      </Button>
    </div>
  );
}

export function Kpis({ items }: { items: [string, string | number][] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border-2 border-blu p-3">
          <dt className="text-base font-bold">{label}</dt>
          <dd className="text-2xl font-extrabold text-blu">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Filters<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    // Segmented control: one tinted track, the chosen option is a raised white pill with a check (not colour alone).
    <div
      role="group"
      aria-label={label}
      className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-blu/10 p-1 sm:inline-flex sm:flex-wrap"
    >
      {options.map(([v, text]) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={`inline-flex min-h-12 items-center justify-center gap-1.5 text-center rounded-xl px-4 font-bold text-blu transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blu ${on ? "bg-white shadow-md ring-2 ring-blu" : "hover:bg-white/70"}`}
          >
            {on && <span aria-hidden="true">✓</span>}
            {text}
          </button>
        );
      })}
    </div>
  );
}

/** KPI tiles that are also the list filter: click a number to see who is behind it. */
export function KpiFilters<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  items: readonly { value: T; label: string; count?: number }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {items.map((i) => {
        const on = value === i.value;
        return (
          <button
            key={i.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(i.value)}
            className={`min-h-24 rounded-xl border-2 border-blu p-3 text-left transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blu ${on ? "bg-blu text-white shadow-md" : "bg-white text-ink hover:bg-blu/10"}`}
          >
            <span className="flex items-start justify-between gap-2 text-base font-bold">
              {i.label}
              {on && <span aria-hidden="true">✓</span>}
            </span>
            <span
              className={`block text-2xl font-extrabold ${on ? "text-white" : "text-blu"}`}
            >
              {i.count ?? "–"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Status as text with a border: never color alone. */
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border-2 border-ink px-3 py-0.5 text-base font-bold">
      {children}
    </span>
  );
}

export function Pager({
  page,
  total,
  pageSize = 50,
  onPage,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Pagine" className="mt-4 flex flex-wrap items-center gap-3">
      <Button
        auto
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Precedente
      </Button>
      <span className="font-bold">
        Pagina {page} di {pages} ({total} risultati)
      </span>
      <Button
        auto
        variant="secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Successiva
      </Button>
    </nav>
  );
}

export function Loading({
  query,
}: {
  query: { isPending: boolean; error: Error | null };
}) {
  if (query.error)
    return (
      <p role="alert" className="mt-4 font-bold text-bordeaux">
        Attenzione: {query.error.message}
      </p>
    );
  return query.isPending ? <p className="mt-4">Caricamento…</p> : null;
}

export const EMPTY = "Nessun risultato.";

/** Error and tax-code warning of a `useGuardedMutation` form. */
export function SaveErrors({
  g,
}: {
  g: {
    error?: string;
    taxWarn?: string;
    pending: boolean;
    force: () => void;
  };
}) {
  return (
    <>
      <FormError message={g.error} />
      {g.taxWarn && (
        <TaxWarning
          message={g.taxWarn}
          onForce={g.force}
          disabled={g.pending}
        />
      )}
    </>
  );
}
