"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Loading, Pager } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ClientFormDialog } from "@/components/gestione/client-form-dialog";
import { api, call } from "@/lib/api/call";
import { useDebounced } from "@/lib/api/hooks";
import { formatEuro } from "@/lib/money";

export default function Utenti() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const dq = useDebounced(q);
  const list = useQuery({
    queryKey: ["clients", { q: dq, page }],
    queryFn: () =>
      call(
        api.GET("/clients", {
          params: { query: { q: dq || undefined, page } },
        }),
      ),
  });
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Assistiti</h1>
      <div className="mt-4">
        <Button auto onClick={() => setAdding(true)}>
          Nuovo utente
        </Button>
      </div>
      <Field
        label="Cerca per nome o telefono"
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
            <p className="mt-4">Nessun utente.</p>
          )}
          <ul className="mt-4 space-y-3">
            {list.data.items.map((c) => (
              <li key={c.id} className="rounded-xl border-2 border-ink p-4">
                <p className="text-xl font-extrabold">
                  <Link
                    className="text-blu underline"
                    href={`/gestione/utenti/${c.id}`}
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                </p>
                <p>
                  {c.phone}
                  {c.memberCardNumber &&
                    ` · Socio, tessera n. ${c.memberCardNumber}`}
                </p>
                <p>
                  {c.bookingsCount} prenotazioni · {c.toInvoiceCount} da
                  fatturare · da incassare {formatEuro(c.toCollectCents)}
                </p>
              </li>
            ))}
          </ul>
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </>
      )}
      <ClientFormDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
