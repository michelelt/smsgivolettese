"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY } from "@/components/posts/post-card";
import { Loading, Pill } from "@/components/ui/bits";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionBar, PageHeader } from "@/components/ui/actions";
import { FormError } from "@/components/ui/bits";
import { useToast } from "@/components/ui/toast";
import { api, call } from "@/lib/api/call";
import { fmtDate } from "@/lib/dates";

export default function Proposta() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [reject, setReject] = useState(false);
  const q = useQuery({
    queryKey: ["proposal", id],
    queryFn: () =>
      call(api.GET("/proposals/{id}", { params: { path: { id } } })),
  });
  const path = { params: { path: { id } } };
  const after = () => {
    qc.invalidateQueries({ queryKey: ["proposals"] });
    qc.invalidateQueries({ queryKey: ["proposals-waiting"] });
    qc.invalidateQueries({ queryKey: ["posts"] });
    qc.invalidateQueries({ queryKey: ["proposal", id] });
  };
  const open = useMutation({
    meta: { inline: true },
    mutationFn: () => call(api.POST("/proposals/{id}/draft", path)),
    onSuccess: (p) => {
      after();
      router.push(`/gestione/bacheca/${p.id}`);
    },
  });
  const publish = useMutation({
    meta: { inline: true },
    mutationFn: () => call(api.POST("/proposals/{id}/publish", path)),
    onSuccess: () => {
      after();
      toast("Proposta pubblicata");
      router.push("/gestione/bacheca");
    },
  });
  const rej = useMutation({
    meta: { inline: true },
    mutationFn: () => call(api.POST("/proposals/{id}/reject", path)),
    onSuccess: () => {
      after();
      toast("Proposta scartata");
      router.push("/gestione/bacheca");
    },
  });
  const p = q.data;
  const busy = open.isPending || publish.isPending || rej.isPending;
  return (
    <>
      <PageHeader title="Proposta" />
      <Loading query={q} />
      {p && (
        <div className="mt-4 max-w-3xl space-y-3">
          <p>
            <Pill>
              {p.status === "attesa"
                ? "Da guardare"
                : p.status === "pubblicata"
                  ? "Pubblicata"
                  : "Scartata"}
            </Pill>
          </p>
          <h2 className="text-2xl font-extrabold">{p.title}</h2>
          <p>
            {CATEGORY[p.category]}
            {p.eventDate && ` · ${fmtDate(p.eventDate)}`}
            {p.location && ` · ${p.location}`}
          </p>
          <p>
            Proposta da <strong>{p.submitterName}</strong>
            {p.submitterContact && ` (${p.submitterContact})`}
          </p>
          <p className="whitespace-pre-line rounded-xl border-2 border-ink bg-white p-4">
            {p.body}
          </p>
          {p.videoUrl && (
            <p>
              Video:{" "}
              <a
                href={p.videoUrl}
                rel="noopener noreferrer"
                target="_blank"
                className="font-bold text-blu underline"
              >
                {p.videoUrl}
              </a>
            </p>
          )}
          {p.photoUrl && (
            // Signed URL, short-lived: plain img, not next/image (ADR-062).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.photoUrl}
              alt={`Foto inviata con la proposta «${p.title}»`}
              className="max-h-96 w-auto rounded-xl"
            />
          )}
          <FormError message={open.error?.message ?? publish.error?.message} />
          {p.status === "attesa" && (
            <ActionBar
              label="Azioni sulla proposta"
              danger={
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => setReject(true)}
                >
                  Scarta
                </Button>
              }
            >
              <Button disabled={busy} onClick={() => publish.mutate()}>
                Pubblica così
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => open.mutate()}
              >
                Apri nell&apos;editor
              </Button>
            </ActionBar>
          )}
          {p.postId && (
            <ButtonLink
              variant="secondary"
              href={`/gestione/bacheca/${p.postId}`}
            >
              Vai all&apos;articolo
            </ButtonLink>
          )}
        </div>
      )}
      <ConfirmDialog
        open={reject}
        onClose={() => setReject(false)}
        title="Scartare la proposta?"
        confirmLabel="Sì, scarta"
        onConfirm={() => rej.mutate()}
        pending={rej.isPending}
        error={rej.error?.message}
      >
        <p className="mt-3">
          La foto inviata viene cancellata. Non si può annullare.
        </p>
      </ConfirmDialog>
    </>
  );
}
