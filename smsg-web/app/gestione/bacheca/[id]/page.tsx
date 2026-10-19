"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PostEditor } from "@/components/gestione/post-editor";
import { Loading } from "@/components/ui/bits";
import { api, call } from "@/lib/api/call";

export default function Articolo() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["post", id],
    queryFn: () => call(api.GET("/posts/{id}", { params: { path: { id } } })),
  });
  if (!q.data) return <Loading query={q} />;
  // key: remount when a new server version arrives after a save, so defaults follow it.
  return <PostEditor key={q.data.updatedAt} post={q.data} />;
}
