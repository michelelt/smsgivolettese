"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/ui/bits";
import { ActionBar, PageHeader } from "@/components/ui/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { api, call } from "@/lib/api/call";
import { dateField, optText } from "@/lib/forms";

const schema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "scriva il titolo")
      .max(200, "al massimo 200 caratteri"),
    category: z.enum(["evento", "avviso", "notizia"]),
    eventDate: dateField,
    location: optText(200),
  })
  .refine((v) => v.category !== "evento" || v.eventDate !== "", {
    path: ["eventDate"],
    message: "per un evento serve la data",
  });
type Values = z.infer<typeof schema>;

export default function NuovoArticolo() {
  const router = useRouter();
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      category: "notizia",
      eventDate: "",
      location: "",
    },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: Values) =>
      call(
        api.POST("/posts", {
          body: {
            title: v.title,
            category: v.category,
            eventDate: v.eventDate || undefined,
            location: v.location.trim() || undefined,
          },
        }),
      ),
    onSuccess: (p) => router.push(`/gestione/bacheca/${p.id}`),
  });
  return (
    <>
      <PageHeader title="Nuovo articolo" />
      <form
        onSubmit={f.handleSubmit((v) => m.mutate(v))}
        noValidate
        className="max-w-xl"
      >
        <Field
          label="Titolo"
          {...f.register("title")}
          error={e.title?.message}
        />
        <Select
          label="Tipo"
          {...f.register("category")}
          error={e.category?.message}
        >
          <option value="notizia">Notizia</option>
          <option value="avviso">Avviso</option>
          <option value="evento">Evento</option>
        </Select>
        <Field
          label="Data dell'evento"
          type="date"
          hint="Obbligatoria per gli eventi"
          {...f.register("eventDate")}
          error={e.eventDate?.message}
        />
        <Field
          label="Luogo (facoltativo)"
          {...f.register("location")}
          error={e.location?.message}
        />
        <FormError message={m.error?.message} />
        <ActionBar label="Azioni">
          <Button type="submit" disabled={m.isPending}>
            Crea e scrivi
          </Button>
          <ButtonLink variant="secondary" href="/gestione/bacheca">
            Annulla
          </ButtonLink>
        </ActionBar>
      </form>
    </>
  );
}
