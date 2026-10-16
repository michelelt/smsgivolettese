"use client";

import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { ToastProvider, useToast } from "@/components/ui/toast";

function makeClient(toast: (text: string, error?: boolean) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: 10_000, retry: false } },
    mutationCache: new MutationCache({
      // Any write can change KPIs and lists elsewhere: refetch what is on screen.
      onSuccess: () => void client.invalidateQueries(),
      // Forms show their own errors (meta.inline); row actions get a toast.
      onError: (e, _v, _c, m) => {
        if (!m.meta?.inline) toast(e.message, true);
      },
    }),
  });
  return client;
}

function Inner({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [qc] = useState(() => makeClient(toast));
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Inner>{children}</Inner>
    </ToastProvider>
  );
}
