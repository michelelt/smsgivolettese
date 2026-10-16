"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./button";

const outside = (e: React.MouseEvent<HTMLDialogElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  return (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  );
};

/** Props for a native <dialog> that closes on a click on the backdrop. */
export function backdropClose() {
  let downOutside = false;
  return {
    // Both press and release must be outside, so a text selection dragged out of a field never closes it.
    onMouseDown: (e: React.MouseEvent<HTMLDialogElement>) => {
      downOutside = e.target === e.currentTarget && outside(e);
    },
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (downOutside && e.target === e.currentTarget && outside(e))
        e.currentTarget.close();
      downOutside = false;
    },
  };
}

/** Native <dialog>: focus trap, Esc and inert background come from the browser. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      {...backdropClose()}
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-xl rounded-2xl border-2 border-ink bg-paper p-6 text-ink backdrop:bg-black/60"
    >
      {open && (
        <>
          <h2 id={id} className="text-2xl font-extrabold text-bordeaux">
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}

/** Row of big buttons at the bottom of a dialog. */
export function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap gap-3">{children}</div>;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="mt-3">{children}</div>
      {error && (
        <p role="alert" className="mt-3 font-bold text-bordeaux">
          Attenzione: {error}
        </p>
      )}
      <DialogActions>
        <Button auto variant="danger" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
        <Button auto variant="secondary" onClick={onClose} autoFocus>
          Indietro
        </Button>
      </DialogActions>
    </Dialog>
  );
}
