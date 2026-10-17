"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Filters, Loading, Pager, Pill } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { api, call } from "@/lib/api/call";
import { CATEGORY } from "@/components/posts/post-card";
import { fmtDate } from "@/lib/dates";

type Tab = "articoli" | "proposte";
const TABS = [
  ["articoli", "Articoli"],
  ["proposte", "Proposte"],
] as const;
const STATUS = [
  ["tutte", "Tutti"],
  ["bozza", "Bozze"],
  ["pubblicata", "Pubblicati"],
] as const;
const PSTATUS = [
  ["attesa", "Da guardare"],
  ["pubblicata", "Pubblicate"],
  ["rifiutata", "Scartate"],
  ["tutte", "Tutte"],
] as const;

function Articoli() {
  const [status, setStatus] = useState<"tutte" | "bozza" | "pubblicata">(
    "tutte",
  );
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["posts", status, page],
    queryFn: () =>
      call(api.GET("/posts", { params: { query: { status, page } } })),
  });
  return (
    <>
      <div className="mt-4">
        <ButtonLink href="/gestione/bacheca/nuovo">Nuovo articolo</ButtonLink>
      </div>
      <Filters
        label="Mostra"
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={STATUS}
      />
      <Loading query={q} />
      {q.data?.items.length === 0 && <p className="mt-4">Nessun articolo.</p>}
      <ul className="mt-4 space-y-3">
        {q.data?.items.map((p) => (
          <li key={p.id} className="rounded-xl border-2 border-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-extrabold">{p.title}</p>
              <Pill>{p.status === "bozza" ? "Bozza" : "Pubblicato"}</Pill>
            </div>
            <p>
              {CATEGORY[p.category]}
              {p.eventDate && ` · ${fmtDate(p.eventDate)}`}
            </p>
            <div className="mt-3">
              <ButtonLink
                variant="secondary"
                href={`/gestione/bacheca/${p.id}`}
                aria-label={`Modifica: ${p.title}`}
              >
                Modifica
              </ButtonLink>
            </div>
          </li>
        ))}
      </ul>
      <Pager page={page} total={q.data?.total ?? 0} onPage={setPage} />
    </>
  );
}

function Proposte() {
  const [status, setStatus] = useState<
    "attesa" | "pubblicata" | "rifiutata" | "tutte"
  >("attesa");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["proposals", status, page],
    queryFn: () =>
      call(api.GET("/proposals", { params: { query: { status, page } } })),
  });
  return (
    <>
      <Filters
        label="Mostra"
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={PSTATUS}
      />
      <Loading query={q} />
      {q.data?.items.length === 0 && <p className="mt-4">Nessuna proposta.</p>}
      <ul className="mt-4 space-y-3">
        {q.data?.items.map((p) => (
          <li key={p.id} className="rounded-xl border-2 border-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-extrabold">{p.title}</p>
              <Pill>
                {p.status === "attesa"
                  ? "Da guardare"
                  : p.status === "pubblicata"
                    ? "Pubblicata"
                    : "Scartata"}
              </Pill>
            </div>
            <p>
              Da {p.submitterName} · {CATEGORY[p.category]}
              {p.hasPhoto && " · con foto"}
            </p>
            <div className="mt-3">
              <ButtonLink
                variant="secondary"
                href={`/gestione/bacheca/proposte/${p.id}`}
                aria-label={`Apri la proposta: ${p.title}`}
              >
                Apri
              </ButtonLink>
            </div>
          </li>
        ))}
      </ul>
      <Pager page={page} total={q.data?.total ?? 0} onPage={setPage} />
    </>
  );
}

export default function Bacheca() {
  const [tab, setTab] = useState<Tab>("articoli");
  // Badge: proposals waiting (cheap: pageSize 1, only `total` is read).
  const waiting = useQuery({
    queryKey: ["proposals-waiting"],
    queryFn: () =>
      call(
        api.GET("/proposals", {
          params: { query: { status: "attesa", pageSize: 1 } },
        }),
      ),
  });
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Bacheca</h1>
      <div
        role="group"
        aria-label="Sezione"
        className="mt-4 flex flex-wrap gap-2"
      >
        {TABS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={tab === v}
            onClick={() => setTab(v)}
            className={`min-h-12 rounded-xl border-2 border-blu px-5 text-lg font-bold ${tab === v ? "bg-blu text-white underline" : "text-blu"}`}
          >
            {label}
            {v === "proposte" && waiting.data
              ? ` (${waiting.data.total} da guardare)`
              : ""}
          </button>
        ))}
      </div>
      {tab === "articoli" ? <Articoli /> : <Proposte />}
      <p className="mt-6">
        <Link href="/notizie" className="font-bold text-blu underline">
          Vedi la pagina pubblica
        </Link>
      </p>
    </>
  );
}
