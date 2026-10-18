import type { Metadata } from "next";
import Link from "next/link";
import { getSessionRole } from "@/lib/supabase/server";
import { SetPasswordForm } from "./form";

export const metadata: Metadata = {
  title: "Imposta la password — SMS Givolettese",
};

export default async function ImpostaPassword() {
  const { claims } = await getSessionRole();
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Scegli la tua password
      </h1>
      {claims ? (
        <SetPasswordForm />
      ) : (
        <p className="mt-4">
          Il link non è valido o è scaduto.{" "}
          <Link className="font-bold text-blu underline" href="/accedi">
            Torna alla pagina di accesso
          </Link>
          .
        </p>
      )}
    </main>
  );
}
