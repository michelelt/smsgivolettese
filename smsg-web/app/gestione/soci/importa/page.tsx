"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type DragEvent } from "react";
import { ActionBar } from "@/components/ui/actions";
import { MemberAddHeader } from "@/components/gestione/member-add-tabs";
import { FormError } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { TYPES } from "@/components/gestione/member-form";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { today } from "@/lib/dates";
import { COLUMNS, parseMembersBook, type Draft } from "@/lib/members-import";

type Result = components["schemas"]["MemberImportResult"];
type Key = keyof Draft;

const MAX_BYTES = 5 * 1024 * 1024;
const LABELS: Partial<Record<Key, string>> = {
  lastName: "Cognome",
  firstName: "Nome",
  taxCode: "Codice fiscale",
  birthDate: "Data di nascita",
  birthPlace: "Luogo di nascita",
  address: "Indirizzo",
  postalCode: "CAP",
  city: "Comune",
  phone: "Telefono",
  email: "Email",
};

export default function ImportaSoci() {
  const qc = useQueryClient();
  const [file, setFile] = useState<string>();
  const [problems, setProblems] = useState<string[]>();
  const [rows, setRows] = useState<Draft[]>([]);
  const [excelRows, setExcelRows] = useState<number[]>([]);
  const [check, setCheck] = useState<Result>();
  const [done, setDone] = useState<Result>();
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [over, setOver] = useState(false);

  const send = (r: Draft[], dryRun: boolean) =>
    call(api.POST("/members/import", { body: { rows: r, dryRun } }));

  const verify = async (r: Draft[]) => {
    setBusy(true);
    setError(undefined);
    try {
      setCheck(await send(r, true));
      setStale(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const load = async (f: File | undefined) => {
    if (!f) return;
    setFile(f.name);
    setProblems(undefined);
    setCheck(undefined);
    setDone(undefined);
    setRows([]);
    if (f.size > MAX_BYTES)
      return setProblems(["Il file supera 5 MB: non è il libro soci."]);
    const p = parseMembersBook(await f.arrayBuffer(), today());
    if (!p.ok) return setProblems(p.problems);
    setRows(p.rows);
    setExcelRows(p.excelRows);
    await verify(p.rows);
  };

  const commit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const r = await send(rows, false);
      setDone(r);
      void qc.invalidateQueries({ queryKey: ["members"] });
      void qc.invalidateQueries({ queryKey: ["org-info"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (i: number, k: Key, v: string | boolean) => {
    setRows((rs) =>
      rs.map((r, j) =>
        j === i
          ? { ...r, [k]: typeof v === "string" ? v.trim() || null : v }
          : r,
      ),
    );
    setStale(true);
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void load(e.dataTransfer.files[0]);
  };

  const results = check?.rows ?? [];
  const bad = results
    .map((r, i) => ({ ...r, i }))
    .filter((r) => r.errors.length > 0);
  const ready = results.length - bad.length;
  const isDup = (r: (typeof bad)[number]) =>
    r.errors.some((e) => e.code === "DUPLICATE");
  const dups = bad.filter(isDup);
  const fix = bad.filter((r) => !isDup(r));

  if (done) {
    const skipped = done.rows
      .map((r, i) => ({ ...r, i }))
      .filter((r) => r.errors.length > 0);
    return (
      <>
        <MemberAddHeader current="/gestione/soci/importa" />
        <p role="status" className="mt-4 text-xl font-bold">
          Importati {done.created} soci.
          {skipped.length > 0 && ` ${skipped.length} righe non importate.`}
        </p>
        {skipped.length > 0 && (
          <ul className="mt-2 list-disc pl-6">
            {skipped.map((r) => (
              <li key={r.i}>
                Riga {excelRows[r.i]} ({rows[r.i]!.lastName}{" "}
                {rows[r.i]!.firstName}):{" "}
                {r.errors.map((e) => e.message).join("; ")}
              </li>
            ))}
          </ul>
        )}
        <ActionBar label="Dopo l'importazione">
          <ButtonLink href="/gestione/soci">
            Vai all&apos;elenco soci
          </ButtonLink>
        </ActionBar>
      </>
    );
  }

  return (
    <>
      <MemberAddHeader current="/gestione/soci/importa" />
      <div className="mx-auto mt-6 max-w-3xl">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          className={`flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 text-center shadow-sm transition focus-within:outline-3 focus-within:outline-blu ${file ? "py-6" : "py-14"} ${over ? "scale-[1.01] border-bordeaux bg-bordeaux/5" : "border-blu/40 bg-white hover:border-blu"}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`text-blu ${file ? "size-10" : "size-16"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
          </svg>
          <span className="mt-3 text-xl font-extrabold text-ink">
            {file ?? "Trascina qui il libro soci"}
          </span>
          <span className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-blu px-6 text-lg font-bold text-white">
            {file ? "Cambia file" : "Scegli file"}
          </span>
          <span className="mt-3 text-sm text-ink/55">.xls · .xlsx · .ods</span>
          <input
            type="file"
            accept=".xls,.xlsx,.ods"
            className="sr-only"
            onChange={(e) => {
              void load(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>

        {problems && (
          <div
            role="alert"
            className="mt-4 rounded-xl border-2 border-bordeaux p-3"
          >
            <p className="font-bold text-bordeaux">
              Non ho potuto caricare il file perché:
            </p>
            <ul className="mt-1 list-disc pl-6">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-2">
              Il file deve avere, nella riga di intestazione, queste colonne:{" "}
              {COLUMNS.join(", ")}.
            </p>
          </div>
        )}
        <FormError message={error} />

        {check && (
          <>
            <dl role="status" className="mt-6 grid grid-cols-3 gap-3">
              {(
                [
                  ["Pronti", ready, "text-blu"],
                  ["Da sistemare", fix.length, "text-bordeaux"],
                  ["Già presenti", dups.length, "text-ink/55"],
                ] as const
              ).map(([l, n, c]) => (
                <div
                  key={l}
                  className="rounded-3xl bg-white p-4 text-center shadow-sm ring-1 ring-ink/10"
                >
                  <dd className={`text-4xl font-extrabold ${c}`}>{n}</dd>
                  <dt className="text-sm font-bold text-ink/60">{l}</dt>
                </div>
              ))}
            </dl>
            {fix.length > 0 && (
              <h2 className="mb-2 ml-1 mt-8 text-sm font-bold uppercase tracking-wider text-ink/55">
                Da sistemare
              </h2>
            )}
            {fix.map(({ i, errors }) => {
              const r = rows[i]!;
              const fields = [
                ...new Set(
                  errors.flatMap((e) =>
                    e.field in LABELS ? [e.field as Key] : [],
                  ),
                ),
              ];
              const taxWarn = errors.some((e) => e.code === "TAX_CODE_INVALID");
              return (
                <fieldset
                  key={i}
                  className="mt-3 rounded-3xl bg-white px-5 pb-5 pt-4 shadow-sm ring-2 ring-bordeaux/30"
                >
                  <legend className="sr-only">
                    Riga {excelRows[i]}: {r.lastName} {r.firstName}
                  </legend>
                  <p className="flex items-baseline justify-between gap-3 font-extrabold">
                    <span>
                      {r.lastName || "?"} {r.firstName || "?"}
                    </span>
                    <span className="text-sm font-bold text-ink/50">
                      riga {excelRows[i]}
                    </span>
                  </p>
                  <ul className="mt-1 text-bordeaux">
                    {errors.map((e) => (
                      <li key={e.field + e.message}>
                        {LABELS[e.field as Key] ?? e.field}: {e.message}
                      </li>
                    ))}
                  </ul>
                  <div className="grid gap-x-5 md:grid-cols-2">
                    {fields.map((k) => (
                      <Field
                        key={k}
                        label={LABELS[k]!}
                        type={k === "birthDate" ? "date" : "text"}
                        defaultValue={(r[k] as string | null) ?? ""}
                        onChange={(e) => edit(i, k, e.target.value)}
                      />
                    ))}
                  </div>
                  {taxWarn && (
                    <Checkbox
                      label="Codice fiscale giusto, importa lo stesso"
                      checked={!!r.taxCodeConfirmed}
                      onChange={(e) =>
                        edit(i, "taxCodeConfirmed", e.target.checked)
                      }
                    />
                  )}
                </fieldset>
              );
            })}
            {dups.length > 0 && (
              <details className="mt-6 rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-ink/10">
                <summary className="cursor-pointer font-bold">
                  Già presenti: non verranno inseriti ({dups.length})
                </summary>
                <ul className="mt-2 text-ink/70">
                  {dups.map(({ i, errors }) => (
                    <li key={i}>
                      {rows[i]!.lastName} {rows[i]!.firstName} ·{" "}
                      {errors.find((e) => e.code === "DUPLICATE")!.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {ready > 0 && (
              <details className="mt-3 rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-ink/10">
                <summary className="cursor-pointer font-bold">
                  Pronti da importare ({ready})
                </summary>
                <ul className="mt-2">
                  {results.map((res, i) =>
                    res.errors.length ? null : (
                      <li key={i} className="flex flex-wrap items-end gap-3">
                        <span className="min-w-60 pb-3">
                          Riga {excelRows[i]}: {rows[i]!.lastName}{" "}
                          {rows[i]!.firstName}
                        </span>
                        <Select
                          label="Tipo"
                          value={rows[i]!.memberType}
                          onChange={(e) =>
                            edit(i, "memberType", e.target.value)
                          }
                        >
                          {TYPES.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </li>
                    ),
                  )}
                </ul>
              </details>
            )}
            <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-ink/10 bg-paper/85 px-4 py-3 backdrop-blur-md">
              <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end [&>button]:sm:w-auto [&>button]:sm:min-w-44">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void verify(rows)}
                >
                  Ricontrolla
                </Button>
                <Button
                  type="button"
                  disabled={busy || stale || ready === 0}
                  onClick={() => void commit()}
                >
                  {stale ? "Ricontrolla prima" : `Importa ${ready} soci`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
