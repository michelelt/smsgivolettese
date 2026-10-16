"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Filters, Kpis, Loading, Pager, Pill } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api, call, saveBlob } from "@/lib/api/call";
import { useDebounced } from "@/lib/api/hooks";
import { currentYear } from "@/lib/dates";

const FILTERS = [
  ["attivi", "Attivi"],
  ["da_rinnovare", "Quota da pagare"],
  ["cessati", "Cessati"],
  ["tutti", "Tutti"],
] as const;
type Filter = (typeof FILTERS)[number][0];

export default function Soci() {
  const year = currentYear();
  const [filter, setFilter] = useState<Filter>("attivi");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const kpis = useQuery({
    queryKey: ["members", "kpis"],
    queryFn: () => call(api.GET("/members/kpis")),
  });
  const list = useQuery({
    queryKey: ["members", { filter, q: dq, page }],
    queryFn: () =>
      call(
        api.GET("/members", {
          params: { query: { filter, q: dq || undefined, page } },
        }),
      ),
  });
  const csv = useMutation({
    mutationFn: () =>
      saveBlob(
        api.GET("/members/export.csv", { parseAs: "blob" }),
        "libro-soci.csv",
      ),
  });
  const k = kpis.data;
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Soci</h1>
      <Loading query={kpis} />
      {k && (
        <Kpis
          items={[
            ["Soci attivi", k.active],
            [`Quota ${year} pagata`, k.paidCurrentYear],
            [`Quota ${year} da pagare`, k.unpaidCurrentYear],
            [`Iscritti nel ${year}`, k.joinedCurrentYear],
          ]}
        />
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink href="/gestione/soci/nuovo">Nuovo socio</ButtonLink>
        <Button
          auto
          variant="secondary"
          disabled={csv.isPending}
          onClick={() => csv.mutate()}
        >
          Esporta CSV
        </Button>
      </div>
      <Filters
        label="Filtro soci"
        value={filter}
        options={FILTERS}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
      />
      <Field
        label="Cerca per nome, tessera o telefono"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <Loading query={list} />
      {list.data && (
        <>
          {list.data.items.length === 0 && (
            <p className="mt-4">Nessun socio in questo elenco.</p>
          )}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {list.data.items.map((m) => (
              <li key={m.id} className="rounded-xl border-2 border-ink p-4">
                <p className="text-xl font-extrabold">
                  <Link
                    className="text-blu underline"
                    href={`/gestione/soci/${m.id}`}
                  >
                    {m.firstName} {m.lastName}
                  </Link>
                </p>
                <p>
                  Tessera n. {m.cardNumber}
                  {m.phone && ` · ${m.phone}`}
                </p>
                <p className="mt-1">
                  {m.status === "cessato" ? (
                    <Pill>Cessato</Pill>
                  ) : (
                    <Pill>
                      Quota {year}{" "}
                      {m.feePaidCurrentYear ? "pagata" : "da pagare"}
                    </Pill>
                  )}
                </p>
              </li>
            ))}
          </ul>
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
