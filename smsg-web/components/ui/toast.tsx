"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; text: string; error: boolean };
const Ctx = createContext<(text: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(Ctx);

let next = 0;

/** One aria-live region for the whole area; errors are prefixed so they are not conveyed by color. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const dismiss = (id: number) => setList((l) => l.filter((t) => t.id !== id));
  const push = useCallback((text: string, error = false) => {
    const id = ++next;
    setList((l) => [...l, { id, text, error }]);
    if (!error)
      setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 10_000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl flex-col gap-2"
      >
        {list.map((t) => (
          <p
            key={t.id}
            className={`flex items-center justify-between gap-3 rounded-xl border-2 bg-white p-3 font-bold shadow-lg ${t.error ? "border-bordeaux text-bordeaux" : "border-blu text-blu"}`}
          >
            <span>{t.error ? `Errore: ${t.text}` : t.text}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="min-h-12 min-w-12 rounded-xl border-2 border-current px-3"
            >
              Chiudi
            </button>
          </p>
        ))}
      </div>
    </Ctx.Provider>
  );
}
