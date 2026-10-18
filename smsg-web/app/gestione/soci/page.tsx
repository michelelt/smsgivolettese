"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/actions";
import { KpiFilters, Loading, Pager, Pill } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api, call, saveBlob } from "@/lib/api/call";
import { useDebounced } from "@/lib/api/hooks";
import { currentYear } from "@/lib/dates";

type Filter = "attivi" | "da_rinnovare" | "cessati" | "tutti";

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
      <PageHeader
        title="Soci"
        actions={
          <>
            <ButtonLink href="/gestione/soci/nuovo">Nuovo socio</ButtonLink>
            <Button
              variant="secondary"
              disabled={csv.isPending}
              onClick={() => csv.mutate()}
            >
              Esporta CSV
            </Button>
          </>
        }
      />
      <Loading query={kpis} />
      <KpiFilters
        label="Filtro soci"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        items={[
          { value: "attivi", label: "Soci attivi", count: k?.active },
          {
            value: "da_rinnovare",
            label: `Quota ${year} da pagare`,
            count: k?.unpaidCurrentYear,
          },
          { value: "cessati", label: "Cessati", count: k?.ceased },
          { value: "tutti", label: "Tutti", count: k?.total },
        ]}
      />
      {k && (
        <p className="mt-2">
          Quota {year} pagata: <strong>{k.paidCurrentYear}</strong> · Iscritti
          nel {year}: <strong>{k.joinedCurrentYear}</strong>
        </p>
      )}
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
