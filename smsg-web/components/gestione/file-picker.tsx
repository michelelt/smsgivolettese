"use client";

import { useState } from "react";
import { bigButtonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** File input styled as a button, with a progress bar while `onFiles` runs. */
export function FilePicker({
  label,
  accept,
  multiple,
  onFiles,
  icon,
}: {
  label: string;
  /** Round camera button (label read by screen readers), for use on top of a photo. */
  icon?: boolean;
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
        title={icon ? label : undefined}
        className={`${icon ? "grid size-14 place-items-center rounded-full bg-white text-blu shadow-lg hover:bg-[#edf1f8]" : bigButtonClass("primary")} focus-within:outline-4 focus-within:outline-offset-2 ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
      >
        {icon ? (
          <>
            <Icon name="camera" />
            <span className="sr-only">{label}</span>
          </>
        ) : busy ? (
          "Caricamento in corso…"
        ) : (
          label
        )}
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
        <div
          className={`space-y-1 ${icon ? "w-64 rounded-lg bg-white p-2 text-ink" : ""}`}
        >
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
        <p
          role="alert"
          className={`font-bold text-bordeaux ${icon ? "w-64 rounded-lg bg-white p-2" : ""}`}
        >
          Errore: {msg}
        </p>
      )}
    </div>
  );
}
