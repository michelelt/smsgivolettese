"use client";

import { useSyncExternalStore } from "react";

const SIZES = [
  { v: "m", label: "A", name: "Testo normale" },
  { v: "l", label: "A+", name: "Testo grande" },
  { v: "xl", label: "A++", name: "Testo molto grande" },
] as const;

const subscribe = (cb: () => void) => {
  window.addEventListener("text-size", cb);
  return () => window.removeEventListener("text-size", cb);
};
const current = () => document.documentElement.dataset.textSize ?? "m";

function setSize(v: string) {
  const root = document.documentElement;
  if (v === "m") root.removeAttribute("data-text-size");
  else root.setAttribute("data-text-size", v);
  try {
    localStorage.setItem("text-size", v);
  } catch {}
  window.dispatchEvent(new Event("text-size"));
}

export function TextSize() {
  const size = useSyncExternalStore(subscribe, current, () => "m");
  return (
    <div
      role="group"
      aria-label="Dimensione testo"
      className="flex rounded-xl bg-[#edf1f8] p-1"
    >
      {SIZES.map((s) => (
        <button
          key={s.v}
          type="button"
          aria-pressed={size === s.v}
          aria-label={`${s.label} ${s.name}`}
          onClick={() => setSize(s.v)}
          className="min-h-11 min-w-11 rounded-lg px-3 font-extrabold text-blu hover:bg-white aria-pressed:bg-blu aria-pressed:text-white"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
