"use client";

import { useQuery } from "@tanstack/react-query";
import { SiteEditor } from "@/components/gestione/site-editor";
import { Loading } from "@/components/ui/bits";
import { api, call } from "@/lib/api/call";

export default function Sito() {
  const q = useQuery({
    queryKey: ["site-settings"],
    queryFn: () =>
      call(api.GET("/public/site-settings", { cache: "no-store" })),
    gcTime: 0, // always start from fresh data
    staleTime: 0,
  });
  const d = q.data;
  return (
    <>
      <Loading query={q} />
      {d && (
        <SiteEditor
          initial={{
            address: d.address ?? "",
            slogan: d.slogan ?? "",
            homeIntro: d.homeIntro ?? "",
            vatNumber: d.vatNumber ?? "",
            conventions: d.conventions.map((c) => ({ ...c, url: c.url ?? "" })),
            footerLinks: d.footerLinks,
          }}
        />
      )}
    </>
  );
}
