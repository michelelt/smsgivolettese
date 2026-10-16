"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { FormError, Loading } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import { orNull } from "@/lib/forms";
import { isHttps } from "@/lib/public/https-url";

const GROUPS = [
  ["associazioni", "Associazioni"],
  ["mutuo_soccorso", "Mutuo soccorso"],
  ["utili", "Link utili"],
] as const;

const httpsUrl = z
  .string()
  .trim()
  .regex(/^https:\/\/\S+$/, "scriva un indirizzo che inizia con https://")
  .refine(isHttps, "scriva un indirizzo che inizia con https://");
const schema = z.object({
  address: z.string().max(200, "al massimo 200 caratteri"),
  slogan: z.string().max(200, "al massimo 200 caratteri"),
  homeIntro: z.string().max(2000, "al massimo 2000 caratteri"),
  vatNumber: z
    .string()
    .refine(
      (v) => v === "" || /^\d{11}$/.test(v.trim()),
      "la partita IVA ha 11 cifre",
    ),
  conventions: z
    .array(
      z.object({
        title: z.string().trim().min(1, "scriva il titolo").max(200),
        description: z
          .string()
          .trim()
          .min(1, "scriva la descrizione")
          .max(1000),
        url: z.union([z.literal(""), httpsUrl]),
      }),
    )
    .max(50),
  footerLinks: z
    .array(
      z.object({
        group: z.enum(["associazioni", "mutuo_soccorso", "utili"]),
        label: z.string().trim().min(1, "scriva il testo del link").max(100),
        url: httpsUrl,
      }),
    )
    .max(60),
});
type Values = z.infer<typeof schema>;

function SiteForm({ initial }: { initial: Values }) {
  const toast = useToast();
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });
  const conv = useFieldArray({ control: f.control, name: "conventions" });
  const links = useFieldArray({ control: f.control, name: "footerLinks" });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: Values) =>
      call(
        api.PUT("/site-settings", {
          body: {
            address: orNull(v.address),
            slogan: orNull(v.slogan),
            homeIntro: orNull(v.homeIntro),
            vatNumber: orNull(v.vatNumber),
            conventions: v.conventions.map((c) => ({
              title: c.title,
              description: c.description,
              ...(c.url && { url: c.url }),
            })),
            footerLinks: v.footerLinks,
          },
        }),
      ),
    onSuccess: () =>
      toast(
        "Info del sito salvate. Sul sito compariranno entro pochi istanti.",
      ),
  });
  return (
    <form
      onSubmit={f.handleSubmit((v) => m.mutate(v))}
      noValidate
      className="max-w-2xl"
    >
      <Field
        label="Indirizzo della sede"
        {...f.register("address")}
        error={e.address?.message}
      />
      <Field
        label="Slogan"
        {...f.register("slogan")}
        error={e.slogan?.message}
      />
      <Textarea
        label="Testo della pagina iniziale"
        {...f.register("homeIntro")}
        error={e.homeIntro?.message}
      />
      <Field
        label="Partita IVA"
        inputMode="numeric"
        hint="11 cifre"
        {...f.register("vatNumber")}
        error={e.vatNumber?.message}
      />

      <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
        Convenzioni
      </h2>
      {conv.fields.map((c, i) => (
        <fieldset
          key={c.id}
          className="mt-4 rounded-xl border-2 border-ink p-4"
        >
          <legend className="px-2 font-bold">Convenzione {i + 1}</legend>
          <Field
            label="Titolo"
            {...f.register(`conventions.${i}.title`)}
            error={e.conventions?.[i]?.title?.message}
          />
          <Textarea
            label="Descrizione"
            {...f.register(`conventions.${i}.description`)}
            error={e.conventions?.[i]?.description?.message}
          />
          <Field
            label="Indirizzo web (facoltativo)"
            inputMode="url"
            {...f.register(`conventions.${i}.url`)}
            error={e.conventions?.[i]?.url?.message}
          />
          <Button
            auto
            type="button"
            variant="danger"
            className="mt-4"
            onClick={() => conv.remove(i)}
          >
            Togli convenzione {i + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        auto
        type="button"
        variant="secondary"
        className="mt-4"
        onClick={() => conv.append({ title: "", description: "", url: "" })}
      >
        Aggiungi convenzione
      </Button>

      <h2 className="mt-8 text-2xl font-extrabold text-bordeaux">
        Link in fondo al sito
      </h2>
      {GROUPS.map(([group, title]) => (
        <section key={group} aria-label={title} className="mt-4">
          <h3 className="text-xl font-extrabold">{title}</h3>
          {links.fields.map((l, i) =>
            l.group !== group ? null : (
              <fieldset
                key={l.id}
                className="mt-3 rounded-xl border-2 border-ink p-4"
              >
                <legend className="px-2 font-bold">
                  {title}: link{" "}
                  {links.fields.slice(0, i).filter((x) => x.group === group)
                    .length + 1}
                </legend>
                <input
                  type="hidden"
                  {...f.register(`footerLinks.${i}.group`)}
                />
                <Field
                  label="Testo del link"
                  {...f.register(`footerLinks.${i}.label`)}
                  error={e.footerLinks?.[i]?.label?.message}
                />
                <Field
                  label="Indirizzo web"
                  inputMode="url"
                  {...f.register(`footerLinks.${i}.url`)}
                  error={e.footerLinks?.[i]?.url?.message}
                />
                <Button
                  auto
                  type="button"
                  variant="danger"
                  className="mt-4"
                  onClick={() => links.remove(i)}
                >
                  Togli link{" "}
                  {links.fields.slice(0, i).filter((x) => x.group === group)
                    .length + 1}{" "}
                  ({title})
                </Button>
              </fieldset>
            ),
          )}
          <Button
            auto
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => links.append({ group, label: "", url: "" })}
          >
            Aggiungi link: {title}
          </Button>
        </section>
      ))}

      <FormError message={m.error?.message} />
      <div className="mt-8">
        <Button auto type="submit" disabled={m.isPending}>
          Salva
        </Button>
      </div>
    </form>
  );
}

export default function Sito() {
  const q = useQuery({
    queryKey: ["site-settings"],
    queryFn: () =>
      call(api.GET("/public/site-settings", { cache: "no-store" })),
    gcTime: 0, // always start the form from fresh data
    staleTime: 0,
  });
  const d = q.data;
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Info del sito</h1>
      <Loading query={q} />
      {d && (
        <SiteForm
          initial={{
            address: d.address ?? "",
            slogan: d.slogan ?? "",
            homeIntro: d.homeIntro ?? "",
            vatNumber: d.vatNumber ?? "",
            conventions: d.conventions.map((c) => ({ ...c, url: c.url ?? "" })),
            footerLinks: d.footerLinks,
          }}
        />
      )}
    </>
  );
}
