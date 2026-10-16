import { ApiStatus } from "@/components/api-status";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-4xl font-extrabold text-bordeaux">
        SMS Givolettese — sito in costruzione
      </h1>
      <p className="mt-4">
        Società di Mutuo Soccorso Givolettese. Stiamo preparando il nuovo sito.
      </p>
      <div className="mt-6 rounded-xl border-2 border-blu p-4 text-blu">
        <ApiStatus />
      </div>
    </main>
  );
}
