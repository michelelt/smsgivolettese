import type { Metadata } from "next";
import { LoginForms } from "./login-forms";

export const metadata: Metadata = { title: "Accedi — SMS Givolettese" };

export default async function Accedi({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; errore?: string; impostata?: string }>;
}) {
  const { next, errore, impostata } = await searchParams;
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">Accedi</h1>
      {errore && (
        <p
          role="alert"
          className="mt-4 rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux"
        >
          Attenzione:{" "}
          {errore === "personale"
            ? "Per il personale l'accesso con link non è disponibile: usa la password. Se l'hai dimenticata, chiedi all'amministratore."
            : "il link non è valido o è scaduto. Richiedine uno nuovo qui sotto."}
        </p>
      )}
      {impostata && (
        <p
          role="status"
          className="mt-4 rounded-xl border-2 border-blu p-3 font-bold text-blu"
        >
          Password impostata: ora entra con email e password.
        </p>
      )}
      <LoginForms next={next} />
    </main>
  );
}
