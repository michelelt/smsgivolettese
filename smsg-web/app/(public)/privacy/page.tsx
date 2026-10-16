import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Informativa sulla privacy",
  alternates: { canonical: "/privacy" },
};

// Placeholder copy: the final text is supplied by the association (phase 8).
export default function Privacy() {
  return (
    <div className="max-w-prose space-y-4">
      <h1 className="text-4xl font-extrabold text-bordeaux">
        Informativa sulla privacy
      </h1>
      <p>
        <b>Testo provvisorio.</b> L&apos;informativa completa sarà pubblicata
        prima dell&apos;apertura del sito.
      </p>
      <h2 className="text-2xl font-extrabold">Titolare del trattamento</h2>
      <p>Società di Mutuo Soccorso Givolettese, Givoletto.</p>
      <h2 className="text-2xl font-extrabold">Dati raccolti da questo sito</h2>
      <p>
        Il sito pubblico è solo informativo: non raccoglie dati personali dei
        visitatori.
      </p>
      <h2 className="text-2xl font-extrabold">Per quanto tempo</h2>
      <p>[Da definire.]</p>
      <h2 className="text-2xl font-extrabold">I suoi diritti</h2>
      <p>
        Può chiedere di vedere, correggere o cancellare i suoi dati rivolgendosi
        alla sede.
      </p>
    </div>
  );
}
