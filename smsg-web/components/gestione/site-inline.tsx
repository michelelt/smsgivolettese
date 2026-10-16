"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

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
 * Text shown as on the public site; a click swaps it for a real textarea in the same spot.
 * Enter (single line) or blur keeps the edit, Esc drops it. No contentEditable: values stay plain strings.
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
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const area = useRef<HTMLTextAreaElement>(null);
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
      area.current?.focus();
      area.current?.select();
    } else if (wasEditing.current) button.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const done = () => {
    if (!cancelled.current && text !== value) onChange(text);
    cancelled.current = false;
    setEditing(false);
  };

  if (editing)
    return (
      <span className={fit ? "inline-block min-w-64" : "block"}>
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
          {value || placeholder}
        </span>
        <span className="flex-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
          <Icon name="edit" />
        </span>
      </button>
      {error && <Problem id={errId}>{error}</Problem>}
    </>
  );
}
