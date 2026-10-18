-- ADR-061: editable public page texts, all-public like the rest of site_settings.
-- Inner shape is validated by the API (Zod); the DB guarantees an object with all six keys.
alter table public.site_settings add column pages jsonb not null default $pages${
  "home": {
    "servicesButton": "I nostri servizi",
    "whereButton": "Dove siamo",
    "quote": "Le Società di Mutuo Soccorso non hanno finalità di lucro, ma perseguono finalità di interesse generale, sulla base del principio costituzionale di sussidiarietà.",
    "quoteSource": "Legge 15 aprile 1886, n. 3818, articolo 1"
  },
  "chiSiamo": {
    "title": "Una società di persone che si aiutano",
    "intro": "La Società di Mutuo Soccorso Givolettese fa parte di una lunga tradizione piemontese: lavoratori e famiglie che, versando una piccola quota, si sostengono a vicenda nei momenti di bisogno.\n\nOggi questo aiuto prende la forma di servizi sanitari per i soci, accompagnamenti, attività culturali e ricreative, e di un luogo dove ritrovarsi.",
    "sections": [
      {
        "heading": "Senza scopo di lucro",
        "body": "Ogni euro raccolto torna ai soci sotto forma di servizi e sostegno."
      },
      {
        "heading": "Porta aperta",
        "body": "Chiunque può iscriversi. Una volta soci, non si viene esclusi per età o per salute."
      },
      {
        "heading": "Decidono i soci",
        "body": "L'assemblea dei soci elegge il consiglio e approva il bilancio ogni anno."
      }
    ]
  },
  "privacy": {
    "title": "Informativa sulla privacy",
    "intro": "Testo provvisorio. L'informativa completa sarà pubblicata prima dell'apertura del sito.",
    "sections": [
      {
        "heading": "Titolare del trattamento",
        "body": "Società di Mutuo Soccorso Givolettese, Givoletto."
      },
      {
        "heading": "Dati raccolti da questo sito",
        "body": "Il sito pubblico è solo informativo: non raccoglie dati personali dei visitatori."
      },
      {
        "heading": "Per quanto tempo",
        "body": "[Da definire.]"
      },
      {
        "heading": "I suoi diritti",
        "body": "Può chiedere di vedere, correggere o cancellare i suoi dati rivolgendosi alla sede."
      }
    ]
  },
  "servizi": {
    "title": "I nostri servizi",
    "intro": ""
  },
  "convenzioni": {
    "title": "Convenzioni",
    "intro": ""
  },
  "doveSiamo": {
    "title": "Dove siamo",
    "intro": ""
  }
}$pages$::jsonb;
alter table public.site_settings alter column pages drop default;
alter table public.site_settings
  add constraint site_settings_pages_valid check (
    jsonb_typeof(pages) = 'object'
    and pages ?& array['home','chiSiamo','privacy','servizi','convenzioni','doveSiamo']
  );
