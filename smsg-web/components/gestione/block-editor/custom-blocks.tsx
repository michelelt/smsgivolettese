"use client";

import { useId, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { bigButtonClass } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media-url";
import { useUpload } from "./upload-context";

const input =
  "min-h-12 w-full rounded-xl border-2 border-ink bg-white px-3 text-lg text-ink";
const card =
  "my-2 space-y-3 rounded-xl border-2 border-dashed border-blu bg-paper p-4 text-ink";
const small =
  "min-h-11 rounded-xl border-2 border-bordeaux bg-white px-3 font-bold text-bordeaux";

function Text({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-base font-bold">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={input}
      />
    </div>
  );
}

function Picker({
  label,
  accept,
  multiple,
  onFiles,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  /** Call `done()` after each file so the bar advances. */
  onFiles: (f: File[], done: () => void) => Promise<void>;
}) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const busy = state === "busy";
  return (
    <div className="space-y-2">
      <label
        className={`${bigButtonClass("primary")} focus-within:outline-4 focus-within:outline-offset-2 ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
      >
        {busy ? "Caricamento in corso…" : label}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={busy}
          className="sr-only"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (!files.length) return;
            setProgress({ done: 0, total: files.length });
            setState("busy");
            try {
              await onFiles(files, () =>
                setProgress((p) => ({ ...p, done: p.done + 1 })),
              );
              setState("idle");
            } catch (err) {
              setMsg(
                err instanceof Error ? err.message : "Caricamento non riuscito",
              );
              setState("error");
            }
          }}
        />
      </label>
      {busy && (
        <div className="space-y-1">
          {/* Single file: no value, so the bar shows as indeterminate. */}
          <progress
            aria-label="Avanzamento del caricamento"
            className="h-4 w-full accent-blu"
            {...(progress.total > 1
              ? { value: progress.done, max: progress.total }
              : {})}
          />
          <p role="status" className="text-base">
            {progress.total > 1
              ? `Caricati ${progress.done} di ${progress.total}…`
              : "Caricamento in corso…"}
          </p>
        </div>
      )}
      {state === "error" && (
        <p role="alert" className="font-bold text-bordeaux">
          Errore: {msg}
        </p>
      )}
    </div>
  );
}

export const gallery = createReactBlockSpec(
  {
    type: "gallery",
    propSchema: { paths: { default: "" }, caption: { default: "" } },
    content: "none",
  },
  {
    render: function GalleryBlock({ block, editor }) {
      const upload = useUpload();
      const [alt, setAlt] = useState("");
      const paths = block.props.paths ? block.props.paths.split(",") : [];
      const set = (p: string[]) =>
        editor.updateBlock(block, { props: { paths: p.join(",") } });
      return (
        <div className={card}>
          <p className="text-lg font-bold">
            Galleria di foto ({paths.length}/30)
          </p>
          <ul className="flex flex-wrap gap-3">
            {paths.map((p) => (
              <li key={p} className="w-28 space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(p)}
                  alt=""
                  className="h-20 w-28 rounded-lg object-cover"
                />
                <button
                  type="button"
                  className={small}
                  aria-label={`Togli la foto ${paths.indexOf(p) + 1}`}
                  onClick={() => set(paths.filter((x) => x !== p))}
                >
                  Togli
                </button>
              </li>
            ))}
          </ul>
          {paths.length < 30 && (
            <Text
              label="Descrizione delle foto da aggiungere (per chi non vede)"
              value={alt}
              onChange={setAlt}
              placeholder="Es. Gita a Roma, i soci davanti al Colosseo"
            />
          )}
          {paths.length < 30 && (
            <Picker
              label="Aggiungi foto"
              accept="image/*"
              multiple
              onFiles={async (files, done) => {
                const added: string[] = [];
                for (const f of files.slice(0, 30 - paths.length)) {
                  added.push(await upload(f, "image", alt));
                  done();
                }
                set([...paths, ...added]);
              }}
            />
          )}
          <Text
            label="Didascalia (facoltativa)"
            value={block.props.caption}
            onChange={(v) =>
              editor.updateBlock(block, { props: { caption: v } })
            }
          />
        </div>
      );
    },
  },
)();

const SOURCES = [
  ["file", "Video dal computer"],
  ["youtube", "Link YouTube"],
  ["vimeo", "Link Vimeo"],
] as const;

export const video = createReactBlockSpec(
  {
    type: "video",
    propSchema: {
      source: {
        default: "youtube",
        values: ["file", "youtube", "vimeo"] as const,
      },
      src: { default: "" },
      caption: { default: "" },
    },
    content: "none",
  },
  {
    render: function VideoBlock({ block, editor }) {
      const upload = useUpload();
      const id = useId();
      const { source, src } = block.props;
      const up = (props: Record<string, string>) =>
        editor.updateBlock(block, { props });
      return (
        <div className={card}>
          <p className="text-lg font-bold">Video</p>
          <label htmlFor={id} className="block text-base font-bold">
            Tipo di video
          </label>
          <select
            id={id}
            value={source}
            className={input}
            onChange={(e) => up({ source: e.target.value, src: "" })}
          >
            {SOURCES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {source === "file" ? (
            <>
              <Picker
                label="Scegli il video (mp4 o webm)"
                accept="video/mp4,video/webm"
                onFiles={async ([f]) => {
                  up({ src: await upload(f, "video") });
                }}
              />
              {src && <p className="text-base">Video caricato: {src}</p>}
            </>
          ) : (
            <Text
              label={
                source === "youtube"
                  ? "Indirizzo del video YouTube"
                  : "Indirizzo del video Vimeo"
              }
              type="url"
              value={src}
              placeholder="https://"
              onChange={(v) => up({ src: v })}
            />
          )}
          <Text
            label="Didascalia (facoltativa)"
            value={block.props.caption}
            onChange={(v) => up({ caption: v })}
          />
        </div>
      );
    },
  },
)();

export const buttonLink = createReactBlockSpec(
  {
    type: "buttonLink",
    propSchema: { label: { default: "" }, href: { default: "" } },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <div className={card}>
        <p className="text-lg font-bold">Pulsante con collegamento</p>
        <Text
          label="Testo del pulsante"
          value={block.props.label}
          onChange={(v) => editor.updateBlock(block, { props: { label: v } })}
        />
        <Text
          label="Indirizzo (https://… oppure /pagina)"
          value={block.props.href}
          onChange={(v) => editor.updateBlock(block, { props: { href: v } })}
        />
      </div>
    ),
  },
)();
