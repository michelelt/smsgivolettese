"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Filters, Loading, Pager } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { BookingList } from "@/components/gestione/booking-list";
import { NewBookingDialog } from "@/components/gestione/new-booking-dialog";
import { api, call } from "@/lib/api/call";
import { useDebounced } from "@/lib/api/hooks";
import { BookingKpis } from "../booking-kpis";

const FILTERS = [
  ["aperte", "Aperte"],
  ["attesa", "Da confermare"],
  ["confermata", "Confermate"],
  ["da_fatturare", "Eseguite da fatturare"],
  ["annullata", "Annullate"],
  ["tutte", "Tutte"],
] as const;
type Status = (typeof FILTERS)[number][0];

export default function Prenotazioni() {
  const router = useRouter();
  const open = useSearchParams().get("nuova") === "1";
  const [status, setStatus] = useState<Status>("aperte");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useQuery({
    queryKey: ["bookings", { status, q: dq, page }],
    queryFn: () =>
      call(
        api.GET("/bookings", {
          params: { query: { status, q: dq || undefined, page } },
        }),
      ),
  });
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Prenotazioni</h1>
      <BookingKpis />
      <div className="mt-4">
        <Button
          auto
          onClick={() => router.replace("/gestione/prenotazioni?nuova=1")}
        >
          Nuova prenotazione
        </Button>
      </div>
      <Filters
        label="Filtro prenotazioni"
        value={status}
        options={FILTERS}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />
      <Field
        label="Cerca per nome, telefono o servizio"
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
          <BookingList items={list.data.items} />
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </>
      )}
      <NewBookingDialog
        open={open}
        onClose={() => router.replace("/gestione/prenotazioni")}
      />
    </>
  );
}
