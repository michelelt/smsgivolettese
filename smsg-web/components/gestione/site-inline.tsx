"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { rich } from "@/lib/rich";
import { fromDom, toggleSize, toHtml } from "@/lib/rich-dom";

/** Error bubble readable on both the white page and the blue hero. */
export function Problem({ id, children }: { id?: string; children: string }) {
  return (
    <span
      id={id}
      role="alert"
      className="mt-1 block w-fit rounded bg-white px-2 text-base font-bold text-bordeaux"
    >
      Attenzione: {children}
    </span>
  );
}

/**
 * Text shown as on the public site; a click swaps it for an editor in the same spot.
 * Enter (single line) or blur keeps the edit, Esc drops it. With `format` the editor is a contentEditable box
 * with a B / I / A+ / A- toolbar, formatting shown live; it is saved as plain text with marks (lib/rich-dom.ts).
 */
export function Inline({
  label,
  value,
  onChange,
  max,
  multiline,
  fit,
  placeholder,
  error,
  className = "",
  format = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  multiline?: boolean;
  /** Sits inside a sentence: natural width instead of the full line. */
  fit?: boolean;
  placeholder: string;
  error?: string;
  className?: string;
  /** false: plain textarea, no toolbar (VAT number, address used for the map). */
  format?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const area = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);
  const wasEditing = useRef(false);
  const errId = `${label.replace(/\W+/g, "-")}-err`;

  useEffect(() => {
    const a = area.current;
    if (a) {
      a.style.height = "auto";
      a.style.height = `${a.scrollHeight}px`; // auto-grow
    }
  }, [text, editing]);
  useEffect(() => {
    if (editing) {
      // Caret at the end, nothing selected: the first key must not wipe the text.
      const a = area.current;
      a?.focus();
      a?.setSelectionRange(a.value.length, a.value.length);
      const b = box.current;
      if (b) {
        b.innerHTML = toHtml(value); // escaped text only, see lib/rich-dom.ts
        b.focus();
        const sel = window.getSelection();
        sel?.selectAllChildren(b);
        sel?.collapseToEnd();
      }
    } else if (wasEditing.current) button.current?.focus();
    wasEditing.current = editing;
    // value only changes when editing ends, so it never resets an open box.
  }, [editing, value]);

  const read = () => (box.current ? fromDom(box.current, !!multiline) : text);
  const tool = (t: "bold" | "italic" | "up" | "down") => {
    const b = box.current;
    if (!b) return;
    // execCommand is deprecated but still the only built-in way to toggle bold/italic in an editable box.
    if (t === "bold" || t === "italic") document.execCommand(t);
    else toggleSize(b, t);
    setText(read());
  };

  const done = () => {
    const now = read();
    if (!cancelled.current && now !== value) onChange(now);
    cancelled.current = false;
    setEditing(false);
  };

  if (editing)
    return (
      <span className={fit ? "inline-block min-w-64" : "block"}>
        {format ? (
          <>
            <span
              role="toolbar"
              aria-label={`Formattazione: ${label}`}
              className="mb-2 flex w-fit gap-1 rounded-lg bg-white p-1 text-blu shadow-md"
            >
              {(
                [
                  ["bold", "Grassetto (Ctrl+B)", "B", "font-extrabold"],
                  ["italic", "Corsivo (Ctrl+I)", "I", "font-serif italic"],
                  ["up", "Testo più grande", "A+", "font-bold"],
                  ["down", "Testo più piccolo", "A-", "text-base font-bold"],
                ] as const
              ).map(([t, name, letter, style]) => (
                <button
                  key={t}
                  type="button"
                  aria-label={name}
                  title={name}
                  // Keep the focus (and the selection) in the box: a blur would close the editor.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => tool(t)}
                  className={`grid size-11 place-items-center rounded-md hover:bg-[#edf1f8] ${style}`}
                >
                  {letter}
                </button>
              ))}
            </span>
            <div
              ref={box}
              role="textbox"
              aria-label={label}
              aria-multiline={!!multiline}
              aria-invalid={!!error || text.length > max}
              contentEditable
              suppressContentEditableWarning
              onInput={() => setText(read())}
              onBlur={done}
              onPaste={(e) => {
                // Plain text only: formatting from Word or web pages is dropped.
                e.preventDefault();
                const t = e.clipboardData.getData("text/plain");
                document.execCommand(
                  "insertText",
                  false,
                  multiline ? t : t.replace(/\n/g, " "),
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  cancelled.current = true;
                  setEditing(false);
                } else if (
                  (e.ctrlKey || e.metaKey) &&
                  (e.key === "b" || e.key === "i")
                ) {
                  e.preventDefault();
                  tool(e.key === "b" ? "bold" : "italic");
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (multiline) document.execCommand("insertLineBreak");
                  else done();
                }
              }}
              className={`block w-full whitespace-pre-wrap break-words rounded outline-2 outline-offset-4 outline-current focus-visible:outline-current ${className}`}
            />
          </>
        ) : (
          <textarea
            ref={area}
            rows={1}
            aria-label={label}
            aria-invalid={!!error || text.length > max}
            value={text}
            onChange={(e) =>
              setText(
                multiline ? e.target.value : e.target.value.replace(/\n/g, " "),
              )
            }
            onBlur={done}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                cancelled.current = true;
                setEditing(false);
              } else if (e.key === "Enter" && !multiline) {
                e.preventDefault();
                done();
              }
            }}
            className={`block w-full resize-none overflow-hidden rounded bg-transparent p-0 text-inherit outline-2 outline-offset-4 outline-current focus-visible:outline-current ${className}`}
            style={{ font: "inherit" }}
          />
        )}
        {text.length >= max * 0.8 && (
          <span
            role="status"
            className={`mt-1 block text-base ${text.length > max ? "font-bold underline" : ""}`}
          >
            {text.length}/{max} caratteri
            {text.length > max && ": troppo lungo"}
          </span>
        )}
      </span>
    );
  return (
    <>
      <button
        ref={button}
        type="button"
        title="Clicca per modificare"
        aria-label={`Modifica ${label}`}
        aria-describedby={error ? errId : undefined}
        onClick={() => {
          cancelled.current = false;
          setText(value);
          setEditing(true);
        }}
        className={`group inline-flex min-h-12 max-w-full ${fit ? "" : "w-full"} items-center gap-2 rounded text-left outline-2 outline-offset-4 outline-dashed outline-current/50 hover:outline-current focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-current ${className}`}
        style={{ font: "inherit" }}
      >
        <span
          className={`min-w-0 whitespace-pre-line break-words ${value ? "" : "italic opacity-90"}`}
        >
          {value ? rich(value) : placeholder}
        </span>
        <span className="flex-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
          <Icon name="edit" />
        </span>
      </button>
      {error && <Problem id={errId}>{error}</Problem>}
    </>
  );
}
