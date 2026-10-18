import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, api, call } from "./call";

/** Debounced value for search boxes. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const useServices = () =>
  useQuery({
    queryKey: ["services"],
    queryFn: () => call(api.GET("/services")),
  });

export const useOrgInfo = () =>
  useQuery({
    queryKey: ["org-info"],
    queryFn: () => call(api.GET("/org-info")),
  });

/**
 * Mutation for forms with a tax code (ADR-048): a 422 TAX_CODE_INVALID becomes a warning,
 * and `force()` resubmits the same values with `taxCodeConfirmed: true`.
 */
export function useGuardedMutation<V, R>(
  fn: (v: V & { taxCodeConfirmed?: boolean }) => Promise<R>,
  onDone: (r: R) => void,
) {
  const [last, setLast] = useState<V>();
  const m = useMutation({
    mutationFn: fn,
    meta: { inline: true },
    onSuccess: onDone,
  });
  const warn =
    m.error instanceof ApiError && m.error.code === "TAX_CODE_INVALID";
  return {
    pending: m.isPending,
    taxWarn: warn ? m.error!.message : undefined,
    error: warn ? undefined : m.error?.message,
    submit: (v: V) => {
      setLast(v);
      m.mutate(v as V & { taxCodeConfirmed?: boolean });
    },
    force: () => last && m.mutate({ ...last, taxCodeConfirmed: true }),
  };
}

export const useMember = (id: string) =>
  useQuery({
    queryKey: ["members", id],
    queryFn: () => call(api.GET("/members/{id}", { params: { path: { id } } })),
  });
