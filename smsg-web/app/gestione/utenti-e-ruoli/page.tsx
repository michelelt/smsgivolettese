"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { GdprActions } from "@/components/gestione/gdpr-actions";
import { PageHeader } from "@/components/ui/actions";
import { Filters, FormError, Loading, Pager, Pill } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  changeRole,
  inviteUser,
  listUsers,
  resetMfa,
  setActive,
  type UserRole,
  type UserRow,
} from "@/lib/api/admin";
import { useDebounced } from "@/lib/api/hooks";
import { createClient } from "@/lib/supabase/client";

const ROLES: [UserRole, string][] = [
  ["volontario", "Volontario"],
  ["staff", "Staff"],
  ["super_admin", "Super admin"],
];
const roleLabel = (r: UserRole) => ROLES.find((x) => x[0] === r)![1];
const ONLY_SA = "È l'unico super admin: nominane un altro prima.";

const inviteSchema = z.object({
  firstName: z.string().trim().min(1, "scrivi il nome").max(100),
  lastName: z.string().trim().min(1, "scrivi il cognome").max(100),
  email: z.string().trim().email("scrivi un indirizzo email valido"),
  role: z.enum(["staff", "super_admin"]),
});
type InviteValues = z.infer<typeof inviteSchema>;

function InviteBody({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const f = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "staff" },
  });
  const e = f.formState.errors;
  const m = useMutation({
    meta: { inline: true },
    mutationFn: inviteUser,
    onSuccess: (_d, x) => {
      toast(`Invito inviato a ${x.email}`);
      void qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });
  return (
    <form onSubmit={f.handleSubmit((x) => m.mutate(x))} noValidate>
      <p className="mt-2">
        La persona riceve un&apos;email per scegliere la password.
      </p>
      <Field
        label="Nome"
        autoComplete="off"
        {...f.register("firstName")}
        error={e.firstName?.message}
      />
      <Field
        label="Cognome"
        autoComplete="off"
        {...f.register("lastName")}
        error={e.lastName?.message}
      />
      <Field
        label="Email"
        type="email"
        autoComplete="off"
        {...f.register("email")}
        error={e.email?.message}
      />
      <Select label="Ruolo" {...f.register("role")} error={e.role?.message}>
        <option value="staff">Staff</option>
        <option value="super_admin">Super admin</option>
      </Select>
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending}>
          Invia l&apos;invito
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

function RoleBody({ u, onClose }: { u: UserRow; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [role, setRole] = useState<UserRole>(u.role);
  const m = useMutation({
    meta: { inline: true },
    mutationFn: () => changeRole(u.id, role),
    onSuccess: () => {
      toast(
        `Ruolo cambiato: ${u.firstName} ${u.lastName} ora è ${roleLabel(role)}`,
      );
      void qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <Select
        label="Nuovo ruolo"
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
      >
        {ROLES.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </Select>
      <FormError message={m.error?.message} />
      <DialogActions>
        <Button auto type="submit" disabled={m.isPending || role === u.role}>
          Salva il ruolo
        </Button>
        <Button auto type="button" variant="secondary" onClick={onClose}>
          Annulla
        </Button>
      </DialogActions>
    </form>
  );
}

type Dlg =
  { kind: "invite" } | { kind: "role" | "toggle" | "mfa"; u: UserRow } | null;

export default function UtentiERuoli() {
  const toast = useToast();
  const qc = useQueryClient();
  const [role, setRole] = useState("");
  const [active, setActive_] = useState<"true" | "false" | "">("true");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [me, setMe] = useState<string>();
  useEffect(() => {
    void createClient()
      .auth.getClaims()
      .then(({ data }) => setMe(data?.claims.sub));
  }, []);
  const dq = useDebounced(q);
  const list = useQuery({
    queryKey: ["users", { role, active, q: dq, page }],
    queryFn: () => listUsers({ role, active, q: dq, page }),
  });
  // Independent of the filters, so the "only super admin" guard is always right.
  const admins = useQuery({
    queryKey: ["users", "active-super-admins"],
    queryFn: () => listUsers({ role: "super_admin", active: "true" }),
  });
  const onlySa = admins.data?.total === 1 ? admins.data.items[0].id : null;
  const close = () => setDlg(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["users"] });
  const toggle = useMutation({
    meta: { inline: true },
    mutationFn: (u: UserRow) => setActive(u.id, !u.active),
    onSuccess: (_d, u) => {
      toast(u.active ? "Utente disattivato" : "Utente riattivato");
      refresh();
      close();
    },
  });
  const mfa = useMutation({
    meta: { inline: true },
    mutationFn: (u: UserRow) => resetMfa(u.id),
    onSuccess: () => {
      toast("Autenticazione a due fattori azzerata");
      close();
    },
  });
  const cur = dlg && dlg.kind !== "invite" ? dlg.u : null;
  return (
    <>
      <PageHeader
        title="Utenti e ruoli"
        actions={
          <Button onClick={() => setDlg({ kind: "invite" })}>
            Invita staff o super admin
          </Button>
        }
      />
      <Filters
        label="Stato degli utenti"
        value={active}
        onChange={(v) => {
          setActive_(v);
          setPage(1);
        }}
        options={[
          ["true", "Attivi"],
          ["false", "Disattivati"],
          ["", "Tutti"],
        ]}
      />
      <Filters
        label="Ruolo"
        value={role}
        onChange={(v) => {
          setRole(v);
          setPage(1);
        }}
        options={[["", "Tutti i ruoli"], ...ROLES]}
      />
      <Field
        label="Cerca per nome o email"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <Loading query={list} />
      {list.data?.items.length === 0 && <p className="mt-4">Nessun utente.</p>}
      <ul className="mt-4 space-y-3">
        {list.data?.items.map((u) => {
          const name = `${u.firstName} ${u.lastName}`;
          const last = u.id === onlySa;
          const self = u.id === me;
          return (
            <li key={u.id} className="rounded-xl border-2 border-ink p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-extrabold">{name}</p>
                <span className="flex gap-2">
                  <Pill>{roleLabel(u.role)}</Pill>
                  <Pill>{u.active ? "Attivo" : "Disattivato"}</Pill>
                  {u.anonymizedAt && <Pill>Anonimizzato</Pill>}
                </span>
              </div>
              <p>
                {u.anonymizedAt ? "Dati cancellati" : u.email}
                {u.phone && ` · ${u.phone}`}
              </p>
              {last && (
                <p className="mt-1 font-bold">
                  È l&apos;unico super admin attivo: ruolo e disattivazione sono
                  bloccati.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end [&>*]:w-full! sm:[&>*]:w-auto!">
                {!u.anonymizedAt && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={last}
                      aria-label={`Cambia ruolo di ${name}`}
                      onClick={() => setDlg({ kind: "role", u })}
                    >
                      Cambia ruolo
                    </Button>
                    <Button
                      variant={u.active ? "danger" : "secondary"}
                      disabled={last && u.active}
                      aria-label={`${u.active ? "Disattiva" : "Riattiva"} ${name}`}
                      onClick={() => setDlg({ kind: "toggle", u })}
                    >
                      {u.active ? "Disattiva" : "Riattiva"}
                    </Button>
                  </>
                )}
                {u.role === "super_admin" && !u.anonymizedAt && !self && (
                  <Button
                    variant="secondary"
                    aria-label={`Azzera autenticazione a due fattori di ${name}`}
                    onClick={() => setDlg({ kind: "mfa", u })}
                  >
                    Azzera autenticazione a due fattori
                  </Button>
                )}
                <GdprActions
                  subject="user"
                  id={u.id}
                  name={name}
                  anonymized={!!u.anonymizedAt || self}
                  canAnonymize={!last}
                  onDone={refresh}
                />
              </div>
              {last && <p className="mt-1 text-base">{ONLY_SA}</p>}
            </li>
          );
        })}
      </ul>
      {list.data && (
        <Pager page={page} total={list.data.total} onPage={setPage} />
      )}

      <Dialog
        open={dlg?.kind === "invite"}
        onClose={close}
        title="Invita staff o super admin"
      >
        <InviteBody onClose={close} />
      </Dialog>
      <Dialog
        open={dlg?.kind === "role"}
        onClose={close}
        title={cur ? `Ruolo di ${cur.firstName} ${cur.lastName}` : ""}
      >
        {dlg?.kind === "role" && <RoleBody u={dlg.u} onClose={close} />}
      </Dialog>
      <ConfirmDialog
        open={dlg?.kind === "toggle"}
        onClose={() => {
          toggle.reset();
          close();
        }}
        title={cur?.active ? "Disattivare l'utente?" : "Riattivare l'utente?"}
        confirmLabel={cur?.active ? "Disattiva" : "Riattiva"}
        pending={toggle.isPending}
        error={toggle.error?.message}
        onConfirm={() => cur && toggle.mutate(cur)}
      >
        {cur?.active
          ? `${cur.firstName} ${cur.lastName} non potrà più entrare. Lo storico resta.`
          : cur && `${cur.firstName} ${cur.lastName} potrà entrare di nuovo.`}
      </ConfirmDialog>
      <ConfirmDialog
        open={dlg?.kind === "mfa"}
        onClose={() => {
          mfa.reset();
          close();
        }}
        title="Azzerare l'autenticazione a due fattori?"
        confirmLabel="Azzera"
        pending={mfa.isPending}
        error={mfa.error?.message}
        onConfirm={() => cur && mfa.mutate(cur)}
      >
        {cur &&
          `${cur.firstName} ${cur.lastName} dovrà configurare di nuovo l'app di autenticazione.`}
      </ConfirmDialog>
    </>
  );
}
