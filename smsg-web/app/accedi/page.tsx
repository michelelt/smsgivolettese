import type { Metadata } from "next";
import { LoginForms } from "./login-forms";

export const metadata: Metadata = { title: "Accedi — SMS Givolettese" };

export default async function Accedi({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; errore?: string }>;
}) {
  const { next, errore } = await searchParams;
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">Accedi</h1>
      {errore && (
        <p
          role="alert"
          className="mt-4 rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux"
        >
          Attenzione: il link non è valido o è scaduto. Richiedine uno nuovo qui
          sotto.
        </p>
      )}
      <LoginForms next={next} />
    </main>
  );
}
