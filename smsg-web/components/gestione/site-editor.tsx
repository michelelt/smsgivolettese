"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ConventionCard,
  DEFAULT_INTRO,
  DEFAULT_SLOGAN,
  FOOTER_GROUPS,
  HomeHero,
  PublicHeader,
  SiteFooter,
  type FooterGroup,
} from "@/components/public/site-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, call } from "@/lib/api/call";
import { orNull } from "@/lib/forms";
import {
  conventionSchema,
  linkSchema,
  siteSchema,
  type ConventionValues,
  type LinkValues,
  type SiteValues,
} from "@/lib/site-settings";
import { Inline, Problem } from "./site-inline";

type Dlg =
  | { kind: "link"; index: number | null; group: FooterGroup }
  | { kind: "conv"; index: number | null; urlOnly: boolean };

const small =
  "min-h-12 rounded-xl border-2 px-4 font-bold disabled:opacity-60 ";
const diff = <T,>(a: T[], b: T[]) =>
  Array.from({ length: Math.max(a.length, b.length) }).filter(
    (_, i) => JSON.stringify(a[i]) !== JSON.stringify(b[i]),
  ).length;
const dirtyCount = (a: SiteValues, b: SiteValues) =>
  (["address", "slogan", "homeIntro", "vatNumber"] as const).filter(
    (k) => a[k] !== b[k],
  ).length +
  diff(a.conventions, b.conventions) +
  diff(a.footerLinks, b.footerLinks);

function LinkForm({
  initial,
  isNew,
  onSave,
  onRemove,
  onClose,
}: {
  initial: LinkValues;
  isNew: boolean;
  onSave: (v: LinkValues) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const f = useForm<LinkValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: initial,
  });
  const e = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit(onSave)} noValidate>
      <Field
        label="Testo del link"
        autoFocus
        {...f.register("label")}
        error={e.label?.message}
      />
      <Field
        label="Indirizzo web"
        inputMode="url"
        hint="Deve iniziare con https://"
        {...f.register("url")}
        error={e.url?.message}
      />
      <DialogActions>
        <Button auto type="submit">
          Conferma
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
        {!isNew && (
          <Button auto type="button" variant="danger" onClick={onRemove}>
            Togli link
          </Button>
        )}
      </DialogActions>
    </form>
  );
}

function ConventionForm({
  initial,
  urlOnly,
  onSave,
  onClose,
}: {
  initial: ConventionValues;
  urlOnly: boolean;
  onSave: (v: ConventionValues) => void;
  onClose: () => void;
}) {
  const f = useForm<ConventionValues>({
    resolver: zodResolver(conventionSchema),
    defaultValues: initial,
  });
  const e = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit(onSave)} noValidate>
      {!urlOnly && (
        <>
          <Field
            label="Titolo"
            autoFocus
            {...f.register("title")}
            error={e.title?.message}
          />
          <Textarea
            label="Descrizione"
            {...f.register("description")}
            error={e.description?.message}
          />
        </>
      )}
      <Field
        label="Indirizzo web (facoltativo)"
        inputMode="url"
        hint="Deve iniziare con https://"
        autoFocus={urlOnly}
        {...f.register("url")}
        error={e.url?.message}
      />
      <DialogActions>
        <Button auto type="submit">
          Conferma
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

export function SiteEditor({ initial }: { initial: SiteValues }) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const n = dirtyCount(saved, draft);

  const edit = (patch: Partial<SiteValues>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setApiErrors({});
  };
  const setItem = <K extends "conventions" | "footerLinks">(
    k: K,
    i: number | null,
    v: SiteValues[K][number],
  ) =>
    edit({
      [k]:
        i === null
          ? [...draft[k], v]
          : draft[k].map((x, j) => (j === i ? v : x)),
    });
  const dropItem = (k: "conventions" | "footerLinks", i: number) =>
    edit({ [k]: draft[k].filter((_, j) => j !== i) });
  const move = (i: number, by: -1 | 1) => {
    const c = [...draft.conventions];
    [c[i], c[i + by]] = [c[i + by]!, c[i]!];
    edit({ conventions: c });
  };

  const live = useMemo(() => {
    const r = siteSchema.safeParse(draft);
    return Object.fromEntries(
      r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]),
    ) as Record<string, string>;
  }, [draft]);
  const err = (k: string) => apiErrors[k] ?? live[k];

  useEffect(() => {
    if (n === 0) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [n]);

  const m = useMutation({
    meta: { inline: true },
    mutationFn: (v: SiteValues) =>
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
    onSuccess: (_, v) => {
      setSaved(v);
      setApiErrors({});
      toast(
        "Info del sito salvate. Sul sito compariranno entro pochi istanti.",
      );
    },
    onError: (e) => {
      // Field-level messages from the API (details: [{path, message}]) land on the field, the rest in a toast.
      const d =
        e instanceof ApiError && Array.isArray(e.details) ? e.details : [];
      const found: Record<string, string> = {};
      for (const x of d as { path?: string; message?: string }[]) {
        const k = (x.path ?? "").replace(/^body\./, "");
        if (k && x.message) found[k] = x.message;
      }
      setApiErrors(found);
      if (Object.keys(found).length === 0) toast(e.message, true);
      else toast("Controlli i campi segnati e riprovi.", true);
    },
  });
  const save = () => {
    if (Object.keys(live).length > 0)
      return toast(
        "Ci sono campi da correggere: sono segnati nella pagina.",
        true,
      );
    m.mutate(draft);
  };

  const conv = dlg?.kind === "conv" ? dlg : null;
  const link = dlg?.kind === "link" ? dlg : null;
  const close = () => setDlg(null);

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b-2 border-blu bg-white px-4 py-3 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-extrabold text-bordeaux">
            Info del sito
          </h1>
          <p
            role="status"
            className={`font-bold ${n ? "text-bordeaux" : "text-ink"}`}
          >
            {n ? `Modifiche non salvate (${n})` : "Nessuna modifica"}
          </p>
          <Button auto onClick={save} disabled={n === 0 || m.isPending}>
            {m.isPending ? "Salvo…" : "Salva e pubblica"}
          </Button>
          <Button
            auto
            variant="secondary"
            disabled={n === 0 || m.isPending}
            onClick={() => {
              setDraft(saved);
              setApiErrors({});
            }}
          >
            Annulla modifiche
          </Button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center font-bold text-blu underline"
          >
            Vedi il sito
            <span className="sr-only"> (si apre in una nuova scheda)</span>
          </a>
        </div>
        <p className="mt-1 text-base">
          Clicca su un testo per cambiarlo. Le modifiche vanno online quando
          premi Salva e pubblica.
        </p>
      </div>

      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-ink bg-paper">
        <PublicHeader inert />
        <div className="space-y-10 p-4 sm:p-6">
          <HomeHero
            preview
            slogan={
              <Inline
                label="slogan"
                value={draft.slogan}
                max={200}
                placeholder={DEFAULT_SLOGAN}
                error={err("slogan")}
                onChange={(slogan) => edit({ slogan })}
              />
            }
            intro={
              <Inline
                label="testo della pagina iniziale"
                value={draft.homeIntro}
                max={2000}
                multiline
                placeholder={DEFAULT_INTRO}
                error={err("homeIntro")}
                onChange={(homeIntro) => edit({ homeIntro })}
              />
            }
          />

          <section aria-labelledby="conv-h" className="space-y-4">
            <h2 id="conv-h" className="text-3xl font-extrabold text-bordeaux">
              Convenzioni
            </h2>
            {draft.conventions.length === 0 && (
              <p>Al momento non ci sono convenzioni in elenco.</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.conventions.map((c, i) => {
                const k = `conventions.${i}`;
                const name = c.title || `convenzione ${i + 1}`;
                return (
                  <ConventionCard
                    key={i}
                    name={name}
                    c={{
                      title: (
                        <Inline
                          label={`titolo della convenzione ${i + 1}`}
                          value={c.title}
                          max={200}
                          placeholder="Titolo"
                          error={err(`${k}.title`)}
                          onChange={(title) =>
                            setItem("conventions", i, { ...c, title })
                          }
                        />
                      ),
                      description: (
                        <Inline
                          label={`descrizione della convenzione ${i + 1}`}
                          value={c.description}
                          max={1000}
                          multiline
                          placeholder="Descrizione"
                          error={err(`${k}.description`)}
                          onChange={(description) =>
                            setItem("conventions", i, { ...c, description })
                          }
                        />
                      ),
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`Modifica indirizzo web della convenzione ${i + 1}`}
                      onClick={() =>
                        setDlg({ kind: "conv", index: i, urlOnly: true })
                      }
                      className="block min-h-12 text-left font-bold text-blu underline"
                    >
                      {c.url ? `Sito: ${c.url}` : "Aggiungi indirizzo web"}
                    </button>
                    {err(`${k}.url`) && <Problem>{err(`${k}.url`)!}</Problem>}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={`Sposta su la convenzione ${i + 1}`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className={`${small} border-blu text-blu`}
                      >
                        Sposta su
                      </button>
                      <button
                        type="button"
                        aria-label={`Sposta giù la convenzione ${i + 1}`}
                        disabled={i === draft.conventions.length - 1}
                        onClick={() => move(i, 1)}
                        className={`${small} border-blu text-blu`}
                      >
                        Sposta giù
                      </button>
                      <button
                        type="button"
                        aria-label={`Togli la convenzione ${i + 1}`}
                        onClick={() => dropItem("conventions", i)}
                        className={`${small} border-bordeaux text-bordeaux`}
                      >
                        Togli
                      </button>
                    </div>
                  </ConventionCard>
                );
              })}
            </div>
            <Button
              auto
              variant="secondary"
              onClick={() =>
                setDlg({ kind: "conv", index: null, urlOnly: false })
              }
            >
              Aggiungi convenzione
            </Button>
          </section>
        </div>

        <SiteFooter
          inert
          links={draft.footerLinks}
          address={
            <Inline
              fit
              label="indirizzo della sede"
              value={draft.address}
              max={200}
              placeholder="indirizzo della sede"
              error={err("address")}
              onChange={(address) => edit({ address })}
            />
          }
          vat={
            <Inline
              fit
              label="partita IVA"
              value={draft.vatNumber}
              max={11}
              placeholder="11 cifre"
              error={err("vatNumber")}
              onChange={(vatNumber) => edit({ vatNumber })}
            />
          }
          renderLink={(l, i) => (
            <>
              <button
                type="button"
                title="Clicca per modificare"
                aria-label={`Modifica link ${l.label || "senza testo"}`}
                onClick={() =>
                  setDlg({ kind: "link", index: i, group: l.group })
                }
                className="inline-flex min-h-12 items-center gap-1 rounded text-left font-bold text-blu underline outline-2 outline-offset-2 outline-dashed outline-blu/50 hover:outline-blu"
              >
                {l.label || "(senza testo)"}
              </button>
              {(err(`footerLinks.${i}.label`) ||
                err(`footerLinks.${i}.url`)) && (
                <Problem>
                  {
                    (err(`footerLinks.${i}.label`) ??
                      err(`footerLinks.${i}.url`))!
                  }
                </Problem>
              )}
            </>
          )}
          groupEnd={(g) => (
            <button
              type="button"
              aria-label={`Aggiungi link: ${FOOTER_GROUPS.find(([x]) => x === g)![1]}`}
              onClick={() => setDlg({ kind: "link", index: null, group: g })}
              className={`${small} mt-2 border-blu text-blu`}
            >
              Aggiungi link
            </button>
          )}
        />
      </div>

      <Dialog
        open={!!link}
        onClose={close}
        title={link?.index === null ? "Nuovo link" : "Modifica link"}
      >
        {link && (
          <LinkForm
            isNew={link.index === null}
            initial={
              link.index === null
                ? { group: link.group, label: "", url: "https://" }
                : draft.footerLinks[link.index]!
            }
            onClose={close}
            onSave={(v) => {
              setItem("footerLinks", link.index, v);
              close();
            }}
            onRemove={() => {
              if (link.index !== null) dropItem("footerLinks", link.index);
              close();
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={!!conv}
        onClose={close}
        title={conv?.index === null ? "Nuova convenzione" : "Indirizzo web"}
      >
        {conv && (
          <ConventionForm
            urlOnly={conv.urlOnly}
            initial={
              conv.index === null
                ? { title: "", description: "", url: "" }
                : draft.conventions[conv.index]!
            }
            onClose={close}
            onSave={(v) => {
              setItem("conventions", conv.index, v);
              close();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
