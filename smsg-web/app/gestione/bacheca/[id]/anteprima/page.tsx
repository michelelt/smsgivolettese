"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PostArticle } from "@/components/posts/post-article";
import { Loading } from "@/components/ui/bits";
import { ButtonLink } from "@/components/ui/button";
import { api, call } from "@/lib/api/call";

export default function Anteprima() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["post", id],
    queryFn: () => call(api.GET("/posts/{id}", { params: { path: { id } } })),
  });
  return (
    <>
      <p
        role="status"
        className="rounded-xl border-2 border-bordeaux bg-white p-3 text-lg font-bold text-bordeaux"
      >
        {q.data?.status === "pubblicata"
          ? "Anteprima della versione salvata"
          : "Anteprima, non pubblicata"}
      </p>
      <div className="my-4">
        <ButtonLink variant="secondary" href={`/gestione/bacheca/${id}`}>
          ← Torna a scrivere
        </ButtonLink>
      </div>
      <Loading query={q} />
      {q.data && <PostArticle post={q.data} />}
    </>
  );
}
