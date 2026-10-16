"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export type ApiState = "loading" | "ok" | "down";

export const statusLabel: Record<ApiState, string> = {
  loading: "API: verifica in corso…",
  ok: "API: collegata",
  down: "API: non raggiungibile",
};

export function StatusView({ state }: { state: ApiState }) {
  return (
    <p role="status" aria-live="polite" className="text-lg font-bold">
      {statusLabel[state]}
    </p>
  );
}

export function ApiStatus() {
  const [state, setState] = useState<ApiState>("loading");
  useEffect(() => {
    api
      .GET("/health")
      .then(({ data }) => setState(data?.status === "ok" ? "ok" : "down"))
      .catch(() => setState("down"));
  }, []);
  return <StatusView state={state} />;
}
