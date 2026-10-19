"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  AddressBlock,
  ChiSiamoBody,
  PrivacyBody,
  SimplePage,
  type PageSection,
} from "@/components/public/page-bodies";
import { ServiceCard } from "@/components/public/service-card";
import {
  ConventionCard,
  DEFAULT_INTRO,
  DEFAULT_SLOGAN,
  FOOTER_GROUPS,
  HomeHero,
  HomeQuote,
  PublicHeader,
  SiteFooter,
  type FooterGroup,
} from "@/components/public/site-parts";
import { ActionBar } from "@/components/ui/actions";
import { Button, ButtonLink } from "@/components/ui/button";
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
  type PagesValues,
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
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const fieldsDiff = (a: object, b: object) =>
  Object.keys(a).filter(
    (k) => !same(a[k as keyof typeof a], b[k as keyof typeof b]),
  ).length;
const dirtyCount = (a: SiteValues, b: SiteValues) =>
  (["address", "slogan", "homeIntro", "vatNumber"] as const).filter(
    (k) => a[k] !== b[k],
  ).length +
  diff(a.conventions, b.conventions) +
  diff(a.footerLinks, b.footerLinks) +
  fieldsDiff(a.pages.home, b.pages.home) +
  (["chiSiamo", "privacy"] as const).reduce(
    (n, k) =>
      n +
      fieldsDiff(
        { ...a.pages[k], sections: 0 },
        { ...b.pages[k], sections: 0 },
      ) +
      diff(a.pages[k].sections, b.pages[k].sections),
    0,
  ) +
  (["servizi", "convenzioni", "doveSiamo"] as const).reduce(
    (n, k) => n + fieldsDiff(a.pages[k], b.pages[k]),
    0,
  ) +
  diff(a.services, b.services);

export const TABS = [
  ["home", "Pagina iniziale", "home"],
  ["chi-siamo", "Chi siamo", "chiSiamo"],
  ["servizi", "Servizi", "servizi"],
  ["convenzioni", "Convenzioni", "convenzioni"],
  ["dove-siamo", "Dove siamo", "doveSiamo"],
  ["privacy", "Privacy", "privacy"],
] as const;
type Tab = (typeof TABS)[number][0];
// Which tab shows a validation path like `pages.chiSiamo.title` or `services.0.name`.
const tabOf = (path: string): Tab => {
  const [a, b] = path.split(".");
  if (a === "pages") return TABS.find((t) => t[2] === b)?.[0] ?? "home";
  if (a === "services") return "servizi";
  if (a === "conventions") return "convenzioni";
  if (a === "address") return "dove-siamo";
  return "home";
};

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

export function SiteEditor({
  initial,
  tab,
}: {
  initial: SiteValues;
  tab: Tab;
}) {
  const toast = useToast();
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const n = dirtyCount(saved, draft);

  const edit = (patch: Partial<SiteValues>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setApiErrors({});
  };
  const setPage = <K extends keyof PagesValues>(
    k: K,
    patch: Partial<PagesValues[K]>,
  ) =>
    edit({ pages: { ...draft.pages, [k]: { ...draft.pages[k], ...patch } } });
  const setService = (
    i: number,
    patch: Partial<SiteValues["services"][number]>,
  ) =>
    edit({
      services: draft.services.map((x, j) =>
        j === i ? { ...x, ...patch } : x,
      ),
    });
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
    // Same-origin link clicks are not covered by beforeunload (client navigation).
    const c = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank") return;
      if (new URL((a as HTMLAnchorElement).href).origin !== location.origin)
        return;
      if (!confirm("Hai modifiche non salvate. Uscire senza salvare?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", h);
    document.addEventListener("click", c, true);
    return () => {
      window.removeEventListener("beforeunload", h);
      document.removeEventListener("click", c, true);
    };
  }, [n]);

  const m = useMutation({
    meta: { inline: true },
    mutationFn: async (v: SiteValues) => {
      if (!same({ ...v, services: [] }, { ...saved, services: [] }))
        await call(
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
              pages: v.pages,
            },
          }),
        );
      // Prices are not touched: PATCH sends only the three texts.
      const changed = v.services.filter(
        (s, i) => !same(s, saved.services.find((o) => o.id === s.id) ?? i),
      );
      const res = await Promise.allSettled(
        changed.map((s) =>
          call(
            api.PATCH("/services/{id}", {
              params: { path: { id: s.id } },
              body: {
                name: s.name,
                description: orNull(s.description),
                scheduleNote: orNull(s.scheduleNote),
              },
            }),
          ),
        ),
      );
      return changed
        .filter((_, i) => res[i]!.status === "rejected")
        .map((s) => s.id);
    },
    onSuccess: (failed, v) => {
      // Services that failed stay "unsaved" so the count keeps showing them.
      setSaved((old) => ({
        ...v,
        services: v.services.map((s) =>
          failed.includes(s.id)
            ? (old.services.find((o) => o.id === s.id) ?? s)
            : s,
        ),
      }));
      setApiErrors({});
      if (failed.length > 0)
        toast(
          `Non sono riuscito a salvare ${failed.length} servizi: riprova.`,
          true,
        );
      else
        toast("Modifiche salvate. Sul sito compariranno entro pochi istanti.");
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
      else toast("Controlla i campi segnati e riprova.", true);
    },
  });
  const save = () => {
    const first = Object.keys(live)[0];
    if (first) {
      const t = tabOf(first);
      if (t !== tab) router.replace(`/gestione/sito?pagina=${t}`);
      return toast(
        `Ci sono campi da correggere nella pagina «${TABS.find((x) => x[0] === t)![1]}»: sono segnati.`,
        true,
      );
    }
    m.mutate(draft);
  };

  const conv = dlg?.kind === "conv" ? dlg : null;
  const link = dlg?.kind === "link" ? dlg : null;
  const close = () => setDlg(null);
  const P = draft.pages;

  const text = (
    label: string,
    path: string,
    value: string,
    max: number,
    onChange: (v: string) => void,
    placeholder: string,
    multiline = false,
  ) => (
    <Inline
      label={label}
      value={value}
      max={max}
      multiline={multiline}
      placeholder={placeholder}
      error={err(path)}
      onChange={onChange}
    />
  );
  const titleAndIntro = (
    k: "chiSiamo" | "privacy" | "servizi" | "convenzioni" | "doveSiamo",
  ) => ({
    title: text(
      "titolo della pagina",
      `pages.${k}.title`,
      P[k].title,
      120,
      (title) => setPage(k, { title }),
      "Titolo",
    ),
    intro: text(
      "testo di presentazione",
      `pages.${k}.intro`,
      P[k].intro,
      2000,
      (intro) => setPage(k, { intro }),
      "Aggiungi un testo di presentazione (facoltativo). Una riga vuota separa i paragrafi.",
      true,
    ),
  });

  const moveSection = (k: "chiSiamo" | "privacy", i: number, by: -1 | 1) => {
    const c = [...P[k].sections];
    [c[i], c[i + by]] = [c[i + by]!, c[i]!];
    setPage(k, { sections: c });
  };
  const sectionsOf = (k: "chiSiamo" | "privacy"): PageSection[] =>
    P[k].sections.map((s, i, all) => {
      const set = (patch: Partial<typeof s>) =>
        setPage(k, {
          sections: all.map((x, j) => (j === i ? { ...x, ...patch } : x)),
        });
      const base = `pages.${k}.sections.${i}`;
      return {
        heading: text(
          `titolo della sezione ${i + 1}`,
          `${base}.heading`,
          s.heading,
          120,
          (heading) => set({ heading }),
          "Titolo",
        ),
        body: text(
          `testo della sezione ${i + 1}`,
          `${base}.body`,
          s.body,
          5000,
          (body) => set({ body }),
          "Testo",
          true,
        ),
        controls: (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              aria-label={`Sposta su la sezione ${i + 1}`}
              disabled={i === 0}
              onClick={() => moveSection(k, i, -1)}
              className={`${small} border-blu text-blu`}
            >
              Sposta su
            </button>
            <button
              type="button"
              aria-label={`Sposta giù la sezione ${i + 1}`}
              disabled={i === all.length - 1}
              onClick={() => moveSection(k, i, 1)}
              className={`${small} border-blu text-blu`}
            >
              Sposta giù
            </button>
            <button
              type="button"
              aria-label={`Togli la sezione ${i + 1}`}
              onClick={() =>
                setPage(k, { sections: all.filter((_, j) => j !== i) })
              }
              className={`${small} border-bordeaux text-bordeaux`}
            >
              Togli
            </button>
          </div>
        ),
      };
    });
  const addSection = (k: "chiSiamo" | "privacy") =>
    P[k].sections.length < 20 && (
      <Button
        auto
        variant="secondary"
        onClick={() =>
          setPage(k, {
            sections: [
              ...P[k].sections,
              { heading: "Nuovo titolo", body: "Nuovo testo" },
            ],
          })
        }
      >
        Aggiungi sezione
      </Button>
    );

  return (
    <>
      <div className="-mx-4 mb-6 border-b-2 border-blu bg-white px-4 py-3 sm:sticky sm:top-0 sm:z-20 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-bordeaux">
            Modifica il sito
          </h1>
          <p
            role="status"
            className={`font-bold ${n ? "text-bordeaux" : "text-ink"}`}
          >
            {n ? `Modifiche non salvate (${n})` : "Nessuna modifica"}
          </p>
        </div>
        <ActionBar label="Salvataggio del sito" compact>
          <Button onClick={save} disabled={n === 0 || m.isPending}>
            {m.isPending ? "Salvo…" : "Salva e pubblica"}
          </Button>
          <Button
            variant="secondary"
            disabled={n === 0 || m.isPending}
            onClick={() => {
              setDraft(saved);
              setApiErrors({});
            }}
          >
            Annulla modifiche
          </Button>
          <ButtonLink
            variant="secondary"
            href="/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vedi il sito
            <span className="sr-only"> (si apre in una nuova scheda)</span>
          </ButtonLink>
        </ActionBar>
        <nav aria-label="Pagine del sito" className="mt-3">
          <ul className="flex flex-wrap gap-2">
            {TABS.map(([slug, label]) => (
              <li key={slug}>
                <Link
                  href={`/gestione/sito?pagina=${slug}`}
                  replace
                  aria-current={slug === tab ? "page" : undefined}
                  className={`inline-flex min-h-12 items-center rounded-xl border-2 px-4 font-bold ${slug === tab ? "border-blu bg-blu text-white underline" : "border-blu text-blu"}`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-1 text-base">
          Clicca su un testo per cambiarlo. Una riga vuota separa i paragrafi.
          Le modifiche vanno online quando premi Salva e pubblica.
        </p>
      </div>

      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-ink bg-paper">
        <PublicHeader inert />
        <div className="space-y-10 p-4 sm:p-6">
          {tab === "home" && (
            <div className="space-y-10">
              <HomeHero
                preview
                slogan={text(
                  "slogan",
                  "slogan",
                  draft.slogan,
                  200,
                  (slogan) => edit({ slogan }),
                  DEFAULT_SLOGAN,
                )}
                intro={text(
                  "testo della pagina iniziale",
                  "homeIntro",
                  draft.homeIntro,
                  2000,
                  (homeIntro) => edit({ homeIntro }),
                  DEFAULT_INTRO,
                  true,
                )}
                servicesButton={text(
                  "pulsante dei servizi",
                  "pages.home.servicesButton",
                  P.home.servicesButton,
                  40,
                  (servicesButton) => setPage("home", { servicesButton }),
                  "Testo del pulsante",
                )}
                whereButton={text(
                  "pulsante di Dove siamo",
                  "pages.home.whereButton",
                  P.home.whereButton,
                  40,
                  (whereButton) => setPage("home", { whereButton }),
                  "Testo del pulsante",
                )}
              />
              <HomeQuote
                quote={text(
                  "citazione",
                  "pages.home.quote",
                  P.home.quote,
                  500,
                  (quote) => setPage("home", { quote }),
                  "Citazione",
                  true,
                )}
                source={text(
                  "fonte della citazione",
                  "pages.home.quoteSource",
                  P.home.quoteSource,
                  200,
                  (quoteSource) => setPage("home", { quoteSource }),
                  "Fonte",
                )}
              />
            </div>
          )}
          {tab === "chi-siamo" && (
            <ChiSiamoBody
              preview
              {...titleAndIntro("chiSiamo")}
              sections={sectionsOf("chiSiamo")}
              after={addSection("chiSiamo")}
            />
          )}
          {tab === "privacy" && (
            <PrivacyBody
              preview
              {...titleAndIntro("privacy")}
              sections={sectionsOf("privacy")}
              after={addSection("privacy")}
            />
          )}
          {tab === "servizi" && (
            <SimplePage preview {...titleAndIntro("servizi")}>
              <p className="rounded-xl border-2 border-blu bg-white p-3">
                Prezzi e nuovi servizi:{" "}
                <Link
                  href="/gestione/servizi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blu underline"
                >
                  Servizi (si apre in una nuova scheda)
                </Link>
                . Qui si vedono solo i servizi attivi.
              </p>
              {draft.services.length === 0 ? (
                <p>Al momento non ci sono servizi in elenco.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {draft.services.map((s, i) => (
                    <ServiceCard
                      key={s.id}
                      s={{
                        name: text(
                          `nome del servizio ${i + 1}`,
                          `services.${i}.name`,
                          s.name,
                          120,
                          (name) => setService(i, { name }),
                          "Nome",
                        ),
                        description: text(
                          `descrizione del servizio ${i + 1}`,
                          `services.${i}.description`,
                          s.description,
                          1000,
                          (description) => setService(i, { description }),
                          "Descrizione",
                          true,
                        ),
                        scheduleNote: text(
                          `quando, per il servizio ${i + 1}`,
                          `services.${i}.scheduleNote`,
                          s.scheduleNote,
                          200,
                          (scheduleNote) => setService(i, { scheduleNote }),
                          "Quando (per esempio: martedì mattina)",
                        ),
                      }}
                    />
                  ))}
                </div>
              )}
            </SimplePage>
          )}
          {tab === "dove-siamo" && (
            <SimplePage preview prose {...titleAndIntro("doveSiamo")}>
              <AddressBlock
                preview
                mapQuery={draft.address}
                address={text(
                  "indirizzo della sede",
                  "address",
                  draft.address,
                  200,
                  (address) => edit({ address }),
                  "indirizzo della sede",
                )}
              />
            </SimplePage>
          )}
          {tab === "convenzioni" && (
            <SimplePage preview {...titleAndIntro("convenzioni")}>
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
                        title: text(
                          `titolo della convenzione ${i + 1}`,
                          `${k}.title`,
                          c.title,
                          200,
                          (title) => setItem("conventions", i, { ...c, title }),
                          "Titolo",
                        ),
                        description: text(
                          `descrizione della convenzione ${i + 1}`,
                          `${k}.description`,
                          c.description,
                          1000,
                          (description) =>
                            setItem("conventions", i, { ...c, description }),
                          "Descrizione",
                          true,
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
            </SimplePage>
          )}
        </div>

        <SiteFooter
          inert
          links={draft.footerLinks}
          address={
            <Inline
              fit
              label="indirizzo nel piè di pagina"
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
