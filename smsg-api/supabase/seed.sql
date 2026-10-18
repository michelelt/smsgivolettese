-- Real starting content, from the facts on the association's current site (smsgivolettese.it).
-- No users: create the first super admin with `make superadmin`. Demo data for tests lives in fixtures/demo.sql.

update public.org_settings set
  tax_code = '00656590015',
  address = 'Via Sandro Pertini 15, 10040 Givoletto (TO)',
  membership_fee_cents = 2500;

insert into public.services (name, description, schedule_note, sort_order) values
  ('Accompagnamenti', 'I nostri volontari accompagnano i soci a visite mediche, esami e terapie.',
   'Su richiesta, con almeno 48 ore di anticipo (sabato e domenica esclusi)', 1),
  ('Giornate di prevenzione', 'Incontri con medici specialisti, con controlli ed ecografie per i soci.',
   'Durante l''anno: le date sono in Eventi e novità', 2),
  ('Ginnastica mentale', 'Incontri gratuiti per allenare la memoria e l''attenzione, con il patrocinio del Comune di Givoletto.',
   'Le date sono in Eventi e novità', 3),
  ('Feste e momenti insieme', 'Feste di stagione nella sede e nell''area verde, per soci, famiglie e volontari.',
   'Durante l''anno', 4);

insert into public.posts (slug, title, category, event_date, location, content, excerpt, status, published_at) values
  ('elezione-consiglio-2026-2029', 'Assemblea per l''elezione del Consiglio 2026–2029', 'evento', '2026-05-24',
   'Sede, Via Sandro Pertini 15, Givoletto',
   '[{"id":"p1","type":"paragraph","props":{},"content":[{"type":"text","text":"Domenica 24 maggio 2026, dalle 10 alle 12, i soci sono chiamati a eleggere il Consiglio di Amministrazione per gli anni 2026–2029.","styles":{}}],"children":[]},
     {"id":"p2","type":"paragraph","props":{},"content":[{"type":"text","text":"Possono votare i soci che hanno rinnovato la tessera 2026 e che sono iscritti da almeno tre mesi prima della data dell''assemblea.","styles":{}}],"children":[]}]',
   'Domenica 24 maggio 2026, dalle 10 alle 12, i soci eleggono il Consiglio di Amministrazione 2026–2029.', 'pubblicata', '2026-05-01'),
  ('ginnastica-mentale', 'Ginnastica mentale: nuovi incontri', 'notizia', null, null,
   '[{"id":"g1","type":"paragraph","props":{},"content":[{"type":"text","text":"Riprendono gli incontri gratuiti di ginnastica mentale, per tenere allenate memoria e attenzione. L''iniziativa ha il patrocinio del Comune di Givoletto.","styles":{}}],"children":[]}]',
   'Riprendono gli incontri gratuiti di ginnastica mentale, con il patrocinio del Comune di Givoletto.', 'pubblicata', '2026-02-01'),
  ('auguri-chiusura-feste-2025', 'Buone feste: la sede resta chiusa dal 22 dicembre al 6 gennaio', 'avviso', null, null,
   '[{"id":"a1","type":"paragraph","props":{},"content":[{"type":"text","text":"La Società augura buone feste a tutti i soci e ai volontari. Gli uffici restano chiusi dal 22 dicembre 2025 al 6 gennaio 2026.","styles":{}}],"children":[]}]',
   'Gli uffici restano chiusi dal 22 dicembre 2025 al 6 gennaio 2026.', 'pubblicata', '2025-12-20'),
  ('festa-di-natale-2025', 'Festa di Natale e rinnovo della tessera', 'evento', '2025-12-13',
   'Sede, Via Sandro Pertini 15, Givoletto',
   '[{"id":"n1","type":"paragraph","props":{},"content":[{"type":"text","text":"Sabato 13 dicembre 2025, dalle 15 alle 17, soci e volontari sono invitati in sede per gli auguri di Natale. Sarà anche l''occasione per rinnovare la tessera 2026.","styles":{}}],"children":[]}]',
   'Sabato 13 dicembre 2025, dalle 15 alle 17: auguri di Natale in sede e rinnovo della tessera.', 'pubblicata', '2025-12-01'),
  ('giornata-prevenzione-gastroenterologia', 'Giornata di prevenzione gastroenterologica', 'evento', '2025-11-29',
   'Fondazione Un Passo Insieme Onlus, Via Alpignano 123B, Val della Torre',
   '[{"id":"v1","type":"paragraph","props":{},"content":[{"type":"text","text":"Una giornata dedicata alla prevenzione, con la visita del gastroenterologo, l''ecografia dell''addome superiore e uno screening neurologico e neuropsicologico.","styles":{}}],"children":[]}]',
   'Visita gastroenterologica, ecografia dell''addome superiore e screening neurologico.', 'pubblicata', '2025-11-10'),
  ('festa-d-autunno-2025', 'Festa d''autunno', 'evento', '2025-10-20', 'Area verde della Società, Givoletto',
   '[{"id":"f1","type":"paragraph","props":{},"content":[{"type":"text","text":"Un pomeriggio insieme nell''area verde della Società, per salutare l''autunno con soci, famiglie e volontari.","styles":{}}],"children":[]}]',
   'Un pomeriggio insieme nell''area verde della Società.', 'pubblicata', '2025-10-05');

update public.site_settings set
  address = 'Via Sandro Pertini 15, 10040 Givoletto (TO)',
  home_intro = 'Dal 1882 ci aiutiamo a vicenda: servizi, accompagnamenti e momenti insieme per i soci e le loro famiglie.',
  conventions = '[{"title":"Tessera FIMIV","description":"Con la tessera della Federazione Italiana Mutualità Integrativa Volontaria i soci hanno sconti sulle visite a pagamento nei centri convenzionati e una piccola copertura assicurativa. La tessera è nominativa e arriva dopo il rinnovo dell''iscrizione.","url":"https://www.fimiv.it"}]',
  footer_links = '[{"group":"mutuo_soccorso","label":"FIMIV – Federazione Italiana Mutualità Integrativa Volontaria","url":"https://www.fimiv.it"},
    {"group":"utili","label":"Comune di Givoletto","url":"https://www.comune.givoletto.to.it"},
    {"group":"utili","label":"Gruppo Facebook della Società","url":"https://www.facebook.com/groups/55669923027"}]';

-- Page texts (ADR-061).
update public.site_settings set pages = $pages${
  "home": {
    "servicesButton": "I nostri servizi",
    "whereButton": "Dove siamo",
    "quote": "Le Società di Mutuo Soccorso non hanno finalità di lucro, ma perseguono finalità di interesse generale, sulla base del principio costituzionale di sussidiarietà.",
    "quoteSource": "Legge 15 aprile 1886, n. 3818, articolo 1"
  },
  "chiSiamo": {
    "title": "Una società di persone che si aiutano",
    "intro": "La Società di Mutuo Soccorso Givolettese nasce nel 1882 e fa parte di una lunga tradizione piemontese: lavoratori e famiglie che, versando una piccola quota, si sostengono a vicenda nei momenti di bisogno.\n\nOggi questo aiuto prende la forma di accompagnamenti, giornate di prevenzione, attività per la mente e feste, nella sede di Via Sandro Pertini 15.",
    "sections": [
      {
        "heading": "La nostra storia",
        "body": "1882: nasce la Società, con 81 soci.\n1902: il primo regolamento e la bandiera storica.\n1935: la Società si costituisce con atto formale; l'anno dopo acquista il terreno per una nuova sede.\n1965: diventa cooperativa e aderisce alla Lega Nazionale delle Cooperative e Mutue.\n2003: un patto di solidarietà con la Società di Mutuo Soccorso Cesare Pozzo porta l'assistenza sanitaria ai soci.\n2004: l'assemblea riporta la Società alla forma di mutuo soccorso, con un nuovo statuto, e restaura la bandiera storica."
      },
      {
        "heading": "Senza scopo di lucro",
        "body": "Ogni euro raccolto torna ai soci sotto forma di servizi e sostegno."
      },
      {
        "heading": "Decidono i soci",
        "body": "L'assemblea dei soci elegge il Consiglio di Amministrazione e approva il bilancio ogni anno."
      },
      {
        "heading": "Il 5 per mille",
        "body": "Può sostenere la Società con il 5 per mille: nella dichiarazione dei redditi scriva il nostro codice fiscale, 00656590015."
      }
    ]
  },
  "privacy": {
    "title": "Informativa sulla privacy",
    "intro": "Testo provvisorio. L'informativa completa sarà pubblicata prima dell'apertura del sito.",
    "sections": [
      {
        "heading": "Titolare del trattamento",
        "body": "Società di Mutuo Soccorso Givolettese, Via Sandro Pertini 15, 10040 Givoletto (TO)."
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
    "intro": "Servizi pensati per i soci e le loro famiglie, svolti dai nostri volontari."
  },
  "convenzioni": {
    "title": "Convenzioni",
    "intro": "Vantaggi riservati ai soci in regola con la tessera."
  },
  "doveSiamo": {
    "title": "Dove siamo",
    "intro": "La sede della Società è in Via Sandro Pertini 15, a Givoletto."
  }
}$pages$::jsonb;
