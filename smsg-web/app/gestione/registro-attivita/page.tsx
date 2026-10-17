"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loading, Pager, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { listAudit, type AuditRow } from "@/lib/api/admin";

const TABLES: [string, string][] = [
  ["profiles", "Profili"],
  ["user_roles", "Ruoli"],
  ["volunteers", "Volontari"],
  ["members", "Soci"],
  ["membership_fees", "Quote"],
  ["invoices", "Fatture"],
  ["invoice_lines", "Righe di fattura"],
  ["invoice_counters", "Numerazione fatture"],
  ["org_settings", "Impostazioni"],
  ["shifts", "Turni"],
  ["shift_assignments", "Assegnazioni ai turni"],
  ["transports", "Trasporti"],
  ["posts", "Articoli"],
  ["clients", "Clienti"],
  ["services", "Servizi"],
  ["site_settings", "Testi del sito"],
  ["media", "Immagini"],
  ["post_proposals", "Proposte"],
];
const ACTIONS: [string, string][] = [
  ["insert", "Creazione"],
  ["update", "Modifica"],
  ["delete", "Cancellazione"],
  ["export", "Esportazione"],
];
const tableLabel = (t: string) => TABLES.find((x) => x[0] === t)?.[1] ?? t;
const actionLabel = (a: string) => ACTIONS.find((x) => x[0] === a)?.[1] ?? a;
const when = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome" });
const show = (v: unknown) =>
  v === null || v === undefined
    ? "—"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);

/** Only the keys that differ (insert/delete: all keys of the one side). */
function changes(r: AuditRow) {
  const keys = new Set([
    ...Object.keys(r.before ?? {}),
    ...Object.keys(r.after ?? {}),
  ]);
  return [...keys]
    .filter(
      (k) =>
        !r.before ||
        !r.after ||
        JSON.stringify(r.before[k]) !== JSON.stringify(r.after[k]),
    )
    .map((k) => ({ k, from: r.before?.[k], to: r.after?.[k] }));
}

function Detail({ r, onClose }: { r: AuditRow; onClose: () => void }) {
  const rows = changes(r);
  return (
    <>
      <p className="mt-2">
        {when(r.at)} · {r.actorName ?? "Sistema"} · {actionLabel(r.action)} su{" "}
        {tableLabel(r.tableName)}
      </p>
      {r.redacted ? (
        <p className="mt-3 rounded-xl border-2 border-ink p-3">
          <b>Dati rimossi</b> per anonimizzazione (GDPR). Resta solo la traccia
          dell&apos;operazione.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3">Nessun dettaglio registrato.</p>
      ) : (
        <table className="mt-3 w-full text-left">
          <caption className="sr-only">Campi cambiati</caption>
          <thead>
            <tr>
              <th scope="col" className="pr-3">
                Campo
              </th>
              <th scope="col" className="pr-3">
                Prima
              </th>
              <th scope="col">Dopo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.k} className="border-t border-black/20 align-top">
                <th scope="row" className="pr-3 font-bold break-all">
                  {c.k}
                </th>
                <td className="pr-3 break-words">{show(c.from)}</td>
                <td className="break-words">{show(c.to)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <DialogActions>
        <Button auto onClick={onClose}>
          Chiudi
        </Button>
      </DialogActions>
    </>
  );
}

export default function RegistroAttivita() {
  const [f, setF] = useState({
    table: "",
    action: "",
    from: "",
    to: "",
    rowId: "",
  });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<AuditRow | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value });
    setPage(1);
  };
  const list = useQuery({
    queryKey: ["audit", f, page],
    queryFn: () => listAudit({ ...f, page }),
  });
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Registro attività
      </h1>
      <p className="mt-2">
        Chi ha fatto cosa, dal più recente. Il registro non si può modificare.
      </p>
      <form
        role="search"
        aria-label="Filtri del registro"
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Select label="Tabella" value={f.table} onChange={set("table")}>
          <option value="">Tutte</option>
          {TABLES.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </Select>
        <Select label="Azione" value={f.action} onChange={set("action")}>
          <option value="">Tutte</option>
          {ACTIONS.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </Select>
        <Field
          label="Dal giorno"
          type="date"
          value={f.from}
          onChange={set("from")}
        />
        <Field
          label="Al giorno"
          type="date"
          value={f.to}
          onChange={set("to")}
        />
        <Field
          label="Codice della riga"
          value={f.rowId}
          onChange={set("rowId")}
          autoComplete="off"
        />
      </form>
      <Loading query={list} />
      {list.data?.items.length === 0 && (
        <p className="mt-4">Nessuna attività trovata.</p>
      )}
      <ul className="mt-4 space-y-3">
        {list.data?.items.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink p-4"
          >
            <div>
              <p className="font-bold">
                {actionLabel(r.action)} · {tableLabel(r.tableName)}
                {r.redacted && (
                  <>
                    {" "}
                    <Pill>Dati rimossi</Pill>
                  </>
                )}
              </p>
              <p>
                {when(r.at)} · {r.actorName ?? "Sistema"}
                {r.actorRole && ` (${r.actorRole})`}
              </p>
            </div>
            <Button
              auto
              variant="secondary"
              aria-label={`Dettagli: ${actionLabel(r.action)} ${tableLabel(r.tableName)} del ${when(r.at)}`}
              onClick={() => setSel(r)}
            >
              Vedi i dettagli
            </Button>
          </li>
        ))}
      </ul>
      {list.data && (
        <Pager page={page} total={list.data.total} onPage={setPage} />
      )}
      <Dialog
        open={!!sel}
        onClose={() => setSel(null)}
        title="Dettaglio operazione"
      >
        {sel && <Detail r={sel} onClose={() => setSel(null)} />}
      </Dialog>
    </>
  );
}
