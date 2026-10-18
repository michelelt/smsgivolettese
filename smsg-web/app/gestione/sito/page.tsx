"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { SiteEditor, TABS } from "@/components/gestione/site-editor";
import { Loading } from "@/components/ui/bits";
import { api, call } from "@/lib/api/call";
import { useServices } from "@/lib/api/hooks";

export default function Sito() {
  const pagina = useSearchParams().get("pagina");
  const tab = TABS.find((t) => t[0] === pagina)?.[0] ?? "home";
  const q = useQuery({
    queryKey: ["site-settings"],
    queryFn: () =>
      call(api.GET("/public/site-settings", { cache: "no-store" })),
    gcTime: 0, // always start from fresh data
    staleTime: 0,
  });
  const sv = useServices();
  const d = q.data;
  return (
    <>
      <Loading query={q} />
      <Loading query={sv} />
      {d && sv.data && (
        <SiteEditor
          tab={tab}
          initial={{
            address: d.address ?? "",
            slogan: d.slogan ?? "",
            homeIntro: d.homeIntro ?? "",
            vatNumber: d.vatNumber ?? "",
            conventions: d.conventions.map((c) => ({ ...c, url: c.url ?? "" })),
            footerLinks: d.footerLinks,
            pages: d.pages,
            services: sv.data.items
              .filter((s) => s.active)
              .map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description ?? "",
                scheduleNote: s.scheduleNote ?? "",
              })),
          }}
        />
      )}
    </>
  );
}
