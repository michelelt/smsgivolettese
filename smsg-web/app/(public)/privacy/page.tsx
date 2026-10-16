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
      <p>
        Società di Mutuo Soccorso Givolettese. I recapiti sono nella pagina
        Contatti.
      </p>
      <h2 className="text-2xl font-extrabold">
        Quali dati raccogliamo e perché
      </h2>
      <p>
        Quando prenota, raccogliamo nome, cognome, numero di telefono ed
        eventuali note. Li usiamo solo per richiamarla e gestire la prenotazione
        (art. 6.1.b GDPR).
      </p>
      <h2 className="text-2xl font-extrabold">Protezione dallo spam</h2>
      <p>
        Il modulo di prenotazione usa Cloudflare Turnstile per bloccare i
        messaggi automatici indesiderati. Turnstile riceve l&apos;indirizzo IP
        del suo browser. Noi conserviamo l&apos;indirizzo IP per poco tempo (di
        norma 1 giorno), solo per limitare le prenotazioni ripetute.
      </p>
      <h2 className="text-2xl font-extrabold">Per quanto tempo</h2>
      <p>[Da definire.]</p>
      <h2 className="text-2xl font-extrabold">I suoi diritti</h2>
      <p>
        Può chiedere di vedere, correggere o cancellare i suoi dati
        contattandoci.
      </p>
    </div>
  );
}
