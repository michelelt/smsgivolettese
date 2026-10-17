"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, call } from "@/lib/api/call";
import { dateField, optText } from "@/lib/forms";
import { resizeImage } from "@/lib/image-resize";
import { createClient } from "@/lib/supabase/client";
import { Turnstile } from "./turnstile";

const schema = z
  .object({
    submitterName: z.string().trim().min(1, "scriva il suo nome").max(120),
    submitterContact: optText(200),
    title: z.string().trim().min(1, "scriva il titolo").max(200),
    category: z.enum(["evento", "avviso", "notizia"]),
    eventDate: dateField,
    location: optText(200),
    body: z
      .string()
      .trim()
      .min(1, "scriva il testo")
      .max(3000, "al massimo 3000 caratteri"),
    videoUrl: z
      .string()
      .max(500)
      .refine(
        (v) => v === "" || /^https:\/\//.test(v),
        "l'indirizzo deve iniziare con https://",
      ),
  })
  .refine((v) => v.category !== "evento" || v.eventDate !== "", {
    path: ["eventDate"],
    message: "per un evento serve la data",
  });
type Values = z.infer<typeof schema>;

async function uploadPhoto(file: File): Promise<string> {
  const r = await resizeImage(file);
  const t = await call(
    api.POST("/public/proposals/upload-url", {
      body: { mime: r.mime, size: r.blob.size },
    }),
  );
  const { error } = await createClient()
    .storage.from(t.bucket)
    .uploadToSignedUrl(t.path, t.token, r.blob, { contentType: r.mime });
  if (error) throw new Error("Non siamo riusciti a caricare la foto. Riprovi.");
  return t.path;
}

export function ProposalForm({ siteKey }: { siteKey: string }) {
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [photo, setPhoto] = useState<File>();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const f = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      submitterName: "",
      submitterContact: "",
      title: "",
      category: "notizia",
      eventDate: "",
      location: "",
      body: "",
      videoUrl: "",
    },
  });
  const e = f.formState.errors;

  const submit = f.handleSubmit(async (v) => {
    if (!token) return setErr("Confermi di non essere un robot, qui sotto.");
    setState("busy");
    setErr("");
    try {
      const photoPath = photo ? await uploadPhoto(photo) : undefined;
      await call(
        api.POST("/public/proposals", {
          body: {
            title: v.title,
            category: v.category,
            eventDate: v.eventDate || undefined,
            location: v.location.trim() || undefined,
            body: v.body,
            photoPath,
            videoUrl: v.videoUrl || undefined,
            submitterName: v.submitterName,
            submitterContact: v.submitterContact.trim() || undefined,
            turnstileToken: token,
          },
        }),
      );
      setState("done");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Invio non riuscito. Riprovi.");
      setState("idle");
    } finally {
      setToken("");
      setReset((n) => n + 1); // token is single use
    }
  });

  if (state === "done")
    return (
      <p
        role="status"
        className="rounded-xl border-2 border-blu p-4 text-xl font-bold"
      >
        Grazie! Abbiamo ricevuto la sua proposta. La leggeremo e, se va bene, la
        pubblicheremo.
      </p>
    );
  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <Field
        label="Il suo nome"
        autoComplete="name"
        {...f.register("submitterName")}
        error={e.submitterName?.message}
      />
      <Field
        label="Come possiamo contattarla (facoltativo)"
        hint="Email o telefono: solo per chiederle chiarimenti, non viene pubblicato."
        {...f.register("submitterContact")}
        error={e.submitterContact?.message}
      />
      <Field label="Titolo" {...f.register("title")} error={e.title?.message} />
      <Select
        label="Di che cosa si tratta"
        {...f.register("category")}
        error={e.category?.message}
      >
        <option value="notizia">Una notizia</option>
        <option value="avviso">Un avviso</option>
        <option value="evento">Un evento</option>
      </Select>
      <Field
        label="Data dell'evento"
        type="date"
        hint="Solo per gli eventi"
        {...f.register("eventDate")}
        error={e.eventDate?.message}
      />
      <Field
        label="Luogo (facoltativo)"
        {...f.register("location")}
        error={e.location?.message}
      />
      <Textarea
        label="Testo"
        rows={8}
        {...f.register("body")}
        error={e.body?.message}
      />
      <div className="mt-4">
        <label htmlFor="photo" className="block font-bold">
          Una foto (facoltativa)
        </label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          className="block min-h-12 text-base"
          onChange={(ev) => setPhoto(ev.target.files?.[0])}
        />
      </div>
      <Field
        label="Link a un video (facoltativo)"
        type="url"
        hint="Per esempio un video su YouTube. Deve iniziare con https://"
        {...f.register("videoUrl")}
        error={e.videoUrl?.message}
      />
      <p className="mt-4">
        Inviando accetta il trattamento dei dati descritto nell&apos;
        <Link href="/privacy" className="font-bold text-blu underline">
          informativa sulla privacy
        </Link>
        .
      </p>
      <div className="mt-4">
        <Turnstile siteKey={siteKey} onToken={setToken} resetKey={reset} />
      </div>
      <FormError message={err} />
      <p role="status" className="mt-2">
        {state === "busy" && "Invio in corso…"}
      </p>
      <div className="mt-4">
        <Button type="submit" disabled={state === "busy"}>
          Invia la proposta
        </Button>
      </div>
    </form>
  );
}
