"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BlockEditor } from "@/components/gestione/block-editor";
import type { ApiBlock } from "@/components/posts/block-types";
import { ActionBar, PageHeader } from "@/components/ui/actions";
import { FormError, Loading, Pill } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { dateField, optText } from "@/lib/forms";
import { mediaUrl } from "@/lib/media-url";
import { uploadMedia } from "@/lib/upload";

type Post = components["schemas"]["StaffPost"];

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

function Editor({ post }: { post: Post }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const content = useRef<ApiBlock[]>(post.content);
  const [cover, setCover] = useState(post.cover);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverErr, setCoverErr] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [del, setDel] = useState(false);
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: post.title,
      category: post.category,
      eventDate: post.eventDate ?? "",
      location: post.location ?? "",
    },
  });
  const e = f.formState.errors;
  const published = post.status === "pubblicata";

  const save = (v: Values) =>
    call(
      api.PATCH("/posts/{id}", {
        params: { path: { id: post.id } },
        body: {
          title: v.title,
          category: v.category,
          eventDate: v.eventDate || null,
          location: v.location.trim() || null,
          coverMediaId: cover?.id ?? null,
          content: content.current,
        },
      }),
    );
  const done = (msg: string) => {
    toast(msg);
    qc.invalidateQueries({ queryKey: ["post", post.id] });
    qc.invalidateQueries({ queryKey: ["posts"] });
  };
  const m = useMutation({
    meta: { inline: true },
    mutationFn: async ({
      v,
      then,
    }: {
      v: Values;
      then: "save" | "publish" | "unpublish";
    }) => {
      await save(v);
      if (then === "publish")
        await call(
          api.POST("/posts/{id}/publish", {
            params: { path: { id: post.id } },
          }),
        );
      if (then === "unpublish")
        await call(
          api.POST("/posts/{id}/unpublish", {
            params: { path: { id: post.id } },
          }),
        );
      return then;
    },
    onSuccess: (then) =>
      done(
        then === "publish"
          ? "Articolo pubblicato"
          : then === "unpublish"
            ? "Articolo ritirato: ora è una bozza"
            : published
              ? "Modifiche salvate"
              : "Bozza salvata",
      ),
  });
  const rm = useMutation({
    meta: { inline: true },
    mutationFn: () =>
      call(api.DELETE("/posts/{id}", { params: { path: { id: post.id } } })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      router.push("/gestione/bacheca");
    },
  });
  const go = (then: "save" | "publish" | "unpublish") =>
    f.handleSubmit((v) => m.mutate({ v, then }))();

  return (
    <>
      <PageHeader title={published ? "Modifica articolo" : "Scrivi articolo"}>
        <p className="mt-2">
          <Pill>{published ? "Pubblicato" : "Bozza"}</Pill>
        </p>
      </PageHeader>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          go("save");
        }}
        noValidate
        className="max-w-3xl"
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

        <section
          aria-labelledby="cover-title"
          className="mt-6 rounded-xl border-2 border-ink p-4"
        >
          <h2 id="cover-title" className="text-xl font-extrabold">
            Foto in evidenza
          </h2>
          {cover && (
            <Image
              src={mediaUrl(cover.path)}
              alt=""
              width={cover.width || 800}
              height={cover.height || 600}
              className="mt-2 h-40 w-auto rounded-xl"
            />
          )}
          <label htmlFor="cover-alt" className="mt-2 block font-bold">
            Testo alternativo della foto (facoltativo)
          </label>
          <p id="cover-alt-hint" className="text-base">
            Descriva la foto per chi non la vede. Lo scriva prima di scegliere
            la foto.
          </p>
          <input
            id="cover-alt"
            type="text"
            maxLength={200}
            aria-describedby="cover-alt-hint"
            value={coverAlt}
            onChange={(ev) => setCoverAlt(ev.target.value)}
            className="mb-2 block min-h-12 w-full rounded-xl border-2 border-ink px-3 text-lg"
          />
          <label htmlFor="cover" className="mt-2 block font-bold">
            {cover
              ? "Cambia la foto in evidenza"
              : "Scegli la foto in evidenza"}
          </label>
          <input
            id="cover"
            type="file"
            accept="image/*"
            disabled={coverBusy}
            className="block min-h-12 text-base"
            onChange={async (ev) => {
              const file = ev.target.files?.[0];
              ev.target.value = "";
              if (!file) return;
              setCoverBusy(true);
              setCoverErr("");
              try {
                setCover(await uploadMedia(file, "image", coverAlt));
              } catch (err) {
                setCoverErr(
                  err instanceof Error
                    ? err.message
                    : "Caricamento non riuscito",
                );
              } finally {
                setCoverBusy(false);
              }
            }}
          />
          <p role="status">{coverBusy && "Caricamento in corso…"}</p>
          <FormError message={coverErr} />
          {cover && (
            <Button
              variant="danger"
              type="button"
              className="mt-3"
              onClick={() => setCover(null)}
            >
              Togli la foto in evidenza
            </Button>
          )}
        </section>

        <div className="mt-6">
          <p id="body-label" className="font-bold">
            Testo
          </p>
          <p className="text-base">
            Scriva qui. Per aggiungere foto, video o pulsanti scriva «/» (barra)
            su una riga vuota.
          </p>
          <div
            role="group"
            aria-labelledby="body-label"
            className="mt-2 rounded-xl border-2 border-ink bg-white p-2"
          >
            <BlockEditor
              initialBlocks={post.content as never}
              onChange={(b) => {
                content.current = b as unknown as ApiBlock[];
              }}
              upload={async (file, kind, alt) =>
                (await uploadMedia(file, kind, alt)).path
              }
            />
          </div>
        </div>

        <FormError message={m.error?.message} />
        <ActionBar
          label="Azioni sull'articolo"
          sticky
          danger={
            <Button type="button" variant="danger" onClick={() => setDel(true)}>
              Elimina
            </Button>
          }
        >
          {published ? (
            <Button type="submit" disabled={m.isPending}>
              Salva le modifiche
            </Button>
          ) : (
            <Button
              type="button"
              disabled={m.isPending}
              onClick={() => go("publish")}
            >
              Pubblica
            </Button>
          )}
          {published ? (
            <Button
              type="button"
              variant="secondary"
              disabled={m.isPending}
              onClick={() => go("unpublish")}
            >
              Ritira (torna bozza)
            </Button>
          ) : (
            <Button type="submit" variant="secondary" disabled={m.isPending}>
              Salva la bozza
            </Button>
          )}
          <ButtonLink
            variant="secondary"
            href={`/gestione/bacheca/${post.id}/anteprima`}
          >
            Anteprima
          </ButtonLink>
        </ActionBar>
      </form>
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        title="Eliminare l'articolo?"
        confirmLabel="Sì, elimina"
        onConfirm={() => rm.mutate()}
        pending={rm.isPending}
        error={rm.error?.message}
      >
        <p className="mt-3">
          L&apos;articolo sparisce anche dal sito. Non si può annullare.
        </p>
      </ConfirmDialog>
    </>
  );
}

export default function Articolo() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["post", id],
    queryFn: () => call(api.GET("/posts/{id}", { params: { path: { id } } })),
  });
  if (!q.data) return <Loading query={q} />;
  // key: remount when a new server version arrives after a save, so defaults follow it.
  return <Editor key={q.data.updatedAt} post={q.data} />;
}
