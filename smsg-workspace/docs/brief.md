# Prompt per Claude Code: piattaforma SMS Givolettese

> Incolla tutto il testo qui sotto in Claude Code, aperto in una cartella vuota.
> Metti nella stessa cartella il file `sms-givolettese.html` (il prototipo): è il riferimento per grafica, testi e percorsi.

---

## Ruolo e obiettivo

Sei il lead engineer di un progetto per la **Società di Mutuo Soccorso Givolettese** (Givoletto, TO), un'associazione di volontari senza scopo di lucro. Devi costruire da zero, pronta per la produzione, la piattaforma che sostituisce il sito attuale. Comprende:

1. un **sito pubblico** per una popolazione anziana e poco abituata alla tecnologia;
2. un **gestionale interno** per super admin, staff e volontari.

Il file `sms-givolettese.html` in questa cartella è un prototipo funzionante, fatto come pagina unica. Usalo come specifica visiva e funzionale: colori, tipografia, testi, percorso di prenotazione in 4 passi, area staff, libro soci, fatturazione, editor a blocchi della bacheca. **Non copiarne l'architettura**: lì i dati stanno in un archivio documentale e tutto è in un unico file; qui devi fare le cose come si deve.

La lingua dell'interfaccia è l'**italiano**. Codice, nomi di variabili, commit e documentazione tecnica sono in **inglese**.

---

## Vincoli non negoziabili

- **Due repository di codice separati:**
  - `smsg-api`: backend, proprietario del database, delle migrazioni e delle regole di business;
  - `smsg-web`: frontend.
- **Un solo punto di ingresso per far girare tutto in locale:** un terzo repository minimale, `smsg-workspace`, che contiene **solo orchestrazione**. Nessun codice applicativo.
  - Include i due repo come git submodule nelle cartelle `api/` e `web/`.
  - Con un solo comando (`make dev`) avvia Supabase locale, l'API e il web.
- **Deploy:** entrambe le app su **Vercel** (regione `fra1`). Database, Auth e Storage sui **due progetti Supabase che ho già** (vedi sotto).
- **TypeScript strict** ovunque. Node LTS, `pnpm`.
- Nessun segreto nel codice. Ogni repo ha un `.env.example` completo e documentato.

### Progetti Supabase esistenti

Due progetti dedicati, `smsg-prod` e `smsg-staging` (piano Pro, `eu-central-1`). **Non crearne altri** e non toccare gli altri progetti dell'organizzazione.

- **Produzione:** project ref `vcpmnpsfcgebhmgqlqeu`, regione `eu-central-1` (Francoforte, UE)
- **Staging** (anteprime Vercel e prove): project ref `ydqdnicpfspqewclqrgk`
- **Sviluppo:** sempre in locale con la Supabase CLI (`supabase start`), mai sui progetti remoti.

Regole:
- **Prima di toccare un progetto remoto,** collegalo con `supabase link --project-ref …` ed esegui `supabase db diff` / `supabase migration list` per vedere cosa contiene già.
- **Se un progetto contiene tabelle o dati che non appartengono a questo progetto, fermati e chiedimi** prima di eseguire migrazioni. Non cancellare né sovrascrivere nulla.
- **Se il progetto è vuoto o è dedicato a questo lavoro,** le migrazioni del repo API diventano l'unica fonte di verità.
- **Regione:** se uno dei due progetti non è in UE, segnalamelo. I dati dei soci devono restare in UE per il GDPR, e la regione di un progetto Supabase non si può cambiare.

---

## Architettura (decisioni già prese: seguile)

### Visione d'insieme

```
Browser ──► smsg-web (Next.js su Vercel)
              │  /api/*  → rewrite Vercel verso smsg-api (stessa origine, niente CORS)
              │  Supabase Auth (solo login/sessione, lato client e server)
              ▼
           smsg-api (Hono su Vercel Functions, Node runtime)
              │  verifica JWT Supabase · autorizzazione per ruolo · validazione Zod
              ▼
           Supabase Postgres (RLS attiva come seconda linea di difesa) + Storage + Auth
```

- **Il frontend legge e scrive dati solo tramite l'API.** Usa `supabase-js` esclusivamente per autenticazione e sessione.
- **Upload di file** (foto, video, allegati): il frontend chiede all'API un **signed upload URL** di Supabase Storage e carica il file direttamente sullo Storage. I file non devono mai passare dalle funzioni Vercel, che hanno un limite di dimensione sul body.
- **Contratto tra i due repo:** l'API espone `/openapi.json`, generato da `@hono/zod-openapi`. Il web genera un client tipizzato con `openapi-typescript` e `openapi-fetch` tramite `pnpm gen:api`. Il file generato è committato nel repo web. La CI dell'API fallisce se lo schema cambia in modo incompatibile senza un bump di versione.

### smsg-api: monolite modulare

```
smsg-api/
  api/index.ts                 # entrypoint Vercel (handle(app))
  src/
    app.ts                     # composizione Hono, middleware, error handler, openapi
    config/env.ts              # env validate con Zod all'avvio
    lib/                       # supabase admin client, logger, errors, pagination
    auth/                      # verifica JWT, estrazione ruolo, permessi
      permissions.ts           # matrice ruoli → azioni (unica fonte di verità)
      requirePermission.ts     # middleware
    modules/
      <feature>/
        <feature>.routes.ts    # solo HTTP: parsing, validazione, risposta
        <feature>.service.ts   # regole di business, nessun dettaglio HTTP
        <feature>.repo.ts      # accesso dati (SQL/query builder), nessuna logica
        <feature>.schemas.ts   # schemi Zod condivisi da routes e OpenAPI
        <feature>.test.ts
  supabase/
    migrations/                # SQL versionato: schema, RLS, funzioni, trigger
    seed.sql                   # dati demo chiaramente marcati come esempi
    config.toml
  scripts/bootstrap-superadmin.ts
```

Regole:
- **Dipendenze a senso unico:** routes → service → repo. I service non importano Hono; i repo non conoscono i ruoli.
- **Accesso al DB:** usa `postgres.js` (oppure Drizzle in sola modalità query) sulla connessione **pooled** di Supabase (Supavisor, porta transaction). Le migrazioni sono SQL scritte a mano nella cartella `supabase/migrations`, gestite con la Supabase CLI.
- **Operazioni critiche in funzioni Postgres transazionali** (`security definer`, `search_path` fissato), chiamate dal service:
  - numerazione fatture;
  - numerazione tessere soci;
  - assegnazione di un volontario con controllo dei conflitti.
- **Errori:** tutti i service lanciano errori di dominio tipizzati (`NotFound`, `Forbidden`, `Conflict`, `Validation`). Un error handler centrale li traduce in JSON `{ error: { code, message } }`, con messaggi in italiano pensati per l'utente finale.
- **Log:** in JSON strutturato, senza dati personali.
- **Audit:** ogni scrittura su soci, fatture, ruoli, turni e trasporti scrive una riga in `audit_log` con chi, cosa, quando, prima e dopo.

### smsg-web: Next.js App Router

```
smsg-web/
  app/
    (public)/                  # sito pubblico: home, servizi, prenota, notizie, notizie/[slug], chi-siamo, contatti
    (auth)/accedi, (auth)/imposta-password
    gestione/                  # area riservata, layout con navigazione per ruolo
      page.tsx                 # cruscotto diverso per ruolo
      prenotazioni/ utenti/ soci/ fatture/ bacheca/ servizi/
      turni/ trasporti/ volontari/ disponibilita/
      impostazioni/ utenti-e-ruoli/ registro-attivita/
  components/ui/               # design system accessibile (Button, Field, Dialog, Toast, Tabs, Badge…)
  components/editor/           # editor a blocchi
  lib/api/                     # client generato + wrapper
  lib/auth/                    # supabase ssr, guard per ruolo
  middleware.ts                # protezione /gestione per sessione e ruolo
```

- **Pagine pubbliche:** Server Components con ISR. Le notizie vengono rivalidate quando lo staff pubblica, con `revalidateTag` chiamato tramite webhook dall'API.
- **Area riservata:** dati con TanStack Query (Client Components) e mutazioni ottimistiche dove ha senso.
- **Stile:** Tailwind CSS con token del design system. Componenti accessibili su Radix UI (o shadcn/ui ricolorato), **non** l'aspetto predefinito.
- **Form:** React Hook Form con risoluzione Zod.
- **PWA installabile** (manifest e icone), così i volontari la aprono dal telefono come un'app.

### Autenticazione e ruoli

- **Supabase Auth.** Login con email e password per staff e super admin. Per i volontari, link magico via email più password opzionale (molti sono anziani: niente passaggi inutili).
- **Ruoli:** tabella `user_roles` (enum `app_role`: `super_admin`, `staff`, `volontario`). Il ruolo viene messo nel JWT con una **Custom Access Token Hook** di Supabase (claim `app_role`). RLS e API leggono il ruolo dal JWT.
- **Gerarchia:** `super_admin` ⊃ `staff` ⊃ `volontario`. La matrice dei permessi in `permissions.ts` è l'unica fonte di verità. Le policy RLS la rispecchiano.
- **Primo super admin:** lo crea `scripts/bootstrap-superadmin.ts` leggendo `SUPERADMIN_EMAIL` e `SUPERADMIN_PASSWORD` dal file `secrets.env` del workspace (non versionato). Lo script è idempotente: la password del file vale solo alla creazione. Dopo, la password del super admin la può cambiare **solo il super admin stesso**.
- **Inviti:**
  - solo il super admin crea staff e cambia ruoli;
  - lo staff può invitare volontari;
  - gli inviti partono da `auth.admin.inviteUserByEmail`, chiamato dall'API con la service role.

| Area | super_admin | staff | volontario |
|---|---|---|---|
| Utenti e ruoli, impostazioni ente, registro attività | ✔ | ✘ | ✘ |
| Servizi e prezzi, info del sito | ✔ | ✔ | ✘ |
| Prenotazioni, utenti/assistiti | ✔ | ✔ | ✘ |
| Libro soci e quote | ✔ | ✔ | ✘ |
| Fatture (emissione, incasso, annullo, export) | ✔ | ✔ | ✘ |
| Bacheca: scrivere, pubblicare, moderare proposte | ✔ | ✔ | proporre |
| **Turni**: creare, assegnare volontari | ✔ | ✔ | vede i propri, conferma/rifiuta |
| **Trasporti**: compilare, assegnare autista | ✔ | ✔ | vede i propri (dati minimi), segna “svolto” con km e note |
| **Disponibilità** | vede/modifica tutte | vede tutte | **inserisce e modifica le proprie** |
| Volontari (anagrafica, patente, mezzi) | ✔ | ✔ | il proprio profilo |

**Minimizzazione dei dati:** un volontario vede di un trasporto assegnato solo nome, telefono, indirizzo di partenza, destinazione, orari ed esigenze (sedia a rotelle, accompagnatore). Non vede mai codice fiscale, fatture o altri assistiti.

---

## Modello dati (Postgres, schema `public`; adatta i nomi se serve, mantieni i concetti)

- `profiles` (id = auth.users.id, nome, cognome, telefono, attivo)
- `user_roles` (user_id, role)
- `volunteers` (profile_id, patente, scadenza_patente, può_guidare, note, attivo)
- `vehicles` (targa, modello, posti, adatto_carrozzina, attivo)
- `availability_rules`: disponibilità ricorrenti (volunteer_id, weekday, start_time, end_time, valid_from, valid_to)
- `availability_exceptions`: assenze o disponibilità extra (volunteer_id, date, start_time, end_time, kind: `assente` | `extra`, nota)
- `shift_types` (sede, centralino, ambulatorio, accompagnamento…)
- `shifts`: turni (type_id, starts_at, ends_at, posti_richiesti, note)
- `shift_assignments` (shift_id, volunteer_id, status: `proposto` | `confermato` | `rifiutato`)
- `transports`:
  - persona trasportata (assistito_id);
  - richiesto_da;
  - data, orario di partenza, orario di appuntamento, ritorno previsto;
  - indirizzo di partenza, destinazione, motivo;
  - carrozzina, accompagnatore;
  - volontario assegnato (driver_volunteer_id) e veicolo (vehicle_id);
  - status: `richiesto` | `assegnato` | `confermato` | `svolto` | `annullato`;
  - km, note dell'autista, booking_id facoltativo.
- `assistiti` (chi prenota o viene trasportato: anagrafica, telefono, codice fiscale facoltativo, indirizzo, socio_id facoltativo)
- `services` (nome, descrizione, prezzo_socio, prezzo_non_socio, quando, prenotabile, ordine, richiede_trasporto)
- `bookings` (assistito_id, service_id, giorno, fascia, orario, prezzo_applicato, origine: `online` | `telefono`, status: `attesa` | `confermata` | `eseguita` | `annullata`, note)
- `members`: soci (tessera univoca progressiva, anagrafica completa, codice fiscale univoco, residenza, tipo, data_iscrizione, stato, cessazione, privacy_firmata_il)
- `membership_fees` (member_id, anno, importo, data, metodo), con un vincolo di unicità su (member_id, anno)
- `invoices` + `invoice_lines` + `invoice_counters` (anno, ultimo)
  - numerazione progressiva per anno, assegnata da una funzione Postgres con `SELECT … FOR UPDATE`;
  - dicitura di esenzione IVA (art. 10 n. 18 DPR 633/72);
  - imposta di bollo di 2 € sopra 77,47 €, con soglia e importo configurabili;
  - stati `emessa` | `pagata` | `annullata`; il numero di una fattura annullata non viene riutilizzato.
- `posts`: bacheca (slug, titolo, categoria `evento` | `avviso` | `notizia`, data_evento, luogo, cover_media_id, content JSON a blocchi, estratto, status `bozza` | `pubblicata`, author_id, published_at)
- `post_proposals` (proposte dei soci dal sito pubblico: testo, foto, link video, nome, contatto, status)
- `media` (bucket, path, mime, size, width, height, alt, uploaded_by)
- `site_settings` (telefono, email, indirizzo, orari, testi della home, quota socio)
- `audit_log`

**Vincoli che il database deve far rispettare da solo:**
- **Niente doppie prenotazioni dello stesso volontario:** exclusion constraint con `btree_gist` sugli intervalli `tstzrange` di turni e trasporti assegnati. Implementalo con una vista o tabella materializzata degli impegni, oppure con un trigger che rifiuta la sovrapposizione.
- **Assegnazioni coerenti:** un trasporto si assegna solo a un volontario con `può_guidare` e patente non scaduta alla data del viaggio.
- **Unicità:** tessera socio, codice fiscale socio, (anno, numero) fattura.
- **RLS attiva su tutte le tabelle,** con policy coerenti con la matrice. Le tabelle che il pubblico può leggere (servizi, post pubblicati, impostazioni del sito) hanno policy `select` per `anon` limitate alle righe pubbliche.

---

## Funzionalità

### Sito pubblico (priorità: accessibilità)

Ricalca il prototipo:
- colori sociali **bordeaux `#7A1E2C`, bianco, blu `#1F3F7A`**;
- testo base 19px e pulsanti per ingrandirlo (A / A+ / A++), con la scelta ricordata;
- menu a grandi pulsanti con icona e scritta;
- telefono sempre visibile.

Pagine:
- **Home:** prossimi appuntamenti, servizi, "Prenotare in tre passi".
- **Servizi:** prezzi per soci e non soci.
- **Prenota:** il percorso guidato in 4 passi del prototipo (servizio → giorno e fascia → dati → conferma).
  - Chi prenota **non deve creare un account**: lascia nome e telefono e viene richiamato.
  - Protezione antispam con Cloudflare Turnstile e rate limiting per IP sull'API.
  - Se il servizio prevede l'accompagnamento, la prenotazione genera anche un trasporto in stato `richiesto`.
- **Notizie:** elenco filtrabile e pagina della singola notizia con foto ingrandibili, gallerie e video.
- **Proponi una notizia:** modulo con foto e link video; va in moderazione.
- **Chi siamo, Contatti.**

Requisiti tecnici:
- SEO di base: metadata, sitemap, Open Graph.
- **Obiettivo:** WCAG 2.1 AA e Lighthouse Accessibility ≥ 95 su tutte le pagine pubbliche.

### Gestione: staff e super admin

Tutto quello che c'è nell'area staff del prototipo:
- **Prenotazioni:** conferma con orario, segnalazione come eseguita, annullo, inserimento telefonico.
- **Utenti/assistiti:** con storico.
- **Libro soci:** registrazione con tessera progressiva, validazione del codice fiscale, quote annuali con ricevuta, cessazione e riattivazione, export CSV.
- **Fatture:** emissione dalle prestazioni eseguite, PDF generato lato server, incasso, annullo, export CSV per il commercialista.
- **Servizi e prezzi, info del sito.**

### Bacheca ed editor a blocchi (stile Gutenberg)

Usa **BlockNote** (o Tiptap con estensioni a blocchi). Non scrivere un editor da zero. Il contenuto è salvato come JSON e viene renderizzato lato server nelle pagine pubbliche, con una whitelist di blocchi.

**Blocchi:** paragrafo, titoletto, foto (con didascalia e misura), galleria, video, citazione, elenco, pulsante-link, separatore.

**Video:** upload diretto su Supabase Storage tramite signed URL, con limite di dimensione configurabile e avviso chiaro; in alternativa un link YouTube o Vimeo incorporato.

**Foto:** ridimensionate e compresse nel browser prima dell'upload (lato lungo massimo 2000px, formato WebP). Le pagine le servono con `next/image`.

**Funzioni:** foto in evidenza, bozze, anteprima, pubblica/aggiorna, moderazione delle proposte (pubblica così / apri nell'editor / scarta).

### Turni (staff)

- **Calendario settimanale:** vista per giorno sul telefono, a griglia su desktop. I turni si creano per tipo, orario e posti richiesti, e si ripetono con un pulsante tipo "copia la settimana".
- **Assegnazione:** cliccando "Assegna", lo staff vede **solo i volontari disponibili** in quell'intervallo, ordinati per numero di turni nel mese (per distribuire il carico). Ogni volontario porta un'etichetta: "disponibile", "già impegnato", "assente".
- **Conflitti:** se lo staff forza un conflitto, l'API risponde `409` con un messaggio chiaro, anche perché il vincolo è nel database.
- **Copertura:** stato visivo di ogni turno (scoperto, parziale, coperto) e conteggio dei turni scoperti nella settimana sul cruscotto.

### Trasporti (staff)

- **Modulo di compilazione:** assistito (ricerca o nuovo), data, orario di partenza e di appuntamento, ritorno, partenza e destinazione, motivo, carrozzina, accompagnatore, note.
- **Assegnazione:** autista scelto tra i volontari disponibili e abilitati; veicolo adatto (per esempio con carrozzina se serve).
- **Elenco del giorno e della settimana**, con stampa del foglio di viaggio come PDF lato server.
- **Chiusura:** a trasporto concluso si registrano km e note. Il riepilogo mensile si esporta in CSV.

### Volontario: interfaccia semplificata al massimo, pensata per il telefono

- **"Le mie disponibilità":** griglia settimanale con caselle grandi (Lunedì–Sabato × Mattina / Pomeriggio, più orari personalizzati opzionali). La disponibilità si salva come ricorrente.
- **"Non ci sono":** per segnare ferie e assenze su un intervallo di date.
- **"I miei impegni":** prossimi turni e trasporti, con pulsanti **Confermo / Non posso**. I trasporti mostrano i dati minimi e un link alla mappa.
- **Promemoria via email** la sera prima. Un cron Vercel chiama l'API una volta al giorno e le email partono con Resend.
- **Notifiche:** quando lo staff assegna un impegno, il volontario riceve un'email.

### Super admin

- **Utenti e ruoli:** invita, disattiva, cambia ruolo. Non può togliere il ruolo all'ultimo super admin.
- **Impostazioni:** dati dell'ente per fatture e ricevute, quota socio, numerazioni.
- **Registro attività:** consultabile e filtrabile.

---

## Qualità

- **Test:**
  - Vitest per i service dell'API (regole di business, numerazioni, conflitti, permessi);
  - test di integrazione contro Supabase locale, comprese le **policy RLS**: per ogni ruolo, verifica cosa può e non può leggere o scrivere;
  - Playwright sul web per i percorsi critici: prenotazione pubblica, login staff, creazione turno e assegnazione, inserimento disponibilità da volontario, emissione fattura.
- **Lint e formattazione:** ESLint + Prettier, `tsc --noEmit` in CI.
- **CI (GitHub Actions):** in ogni repo lint, typecheck, test. Nel repo API, sul branch `main`, `supabase db push` verso il progetto di produzione, eseguito **prima** del deploy Vercel. Ogni pull request ha un'anteprima Vercel collegata al progetto Supabase di staging (vedi "Progetti Supabase esistenti").
- **Sicurezza:**
  - header di sicurezza (CSP) sul web;
  - CORS non necessario grazie al rewrite;
  - rate limiting sugli endpoint pubblici;
  - validazione Zod su ogni input;
  - la service role key esiste solo nell'API, mai nel browser.
- **GDPR:**
  - dati in UE;
  - nessun dato sanitario oltre al tipo di prestazione;
  - export dei dati di una persona e cancellazione o anonimizzazione su richiesta, disponibili al super admin;
  - pagina Privacy con i placeholder da completare.

---

## Il punto di ingresso unico: `smsg-workspace`

```
smsg-workspace/
  api/  (submodule → smsg-api)
  web/  (submodule → smsg-web)
  Makefile
  .env.example        # variabili comuni, propagate ai due progetti
  README.md           # guida passo passo per un volontario con poca esperienza
```

Target del Makefile (che devono funzionare davvero):
- `make setup`: controlla i prerequisiti (Node, pnpm, Docker, Supabase CLI), inizializza i submodule, installa le dipendenze, crea i file `.env.local` dai template.
- `make dev`: avvia Supabase locale, applica migrazioni e seed, rigenera il client API, poi lancia **in parallelo** l'API (porta 3001) e il web (porta 3000) con output colorato e prefissato. `Ctrl+C` ferma tutto.
- `make test`: esegue i test di entrambi i repo.
- `make db-reset`: azzera il database locale con il seed.
- `make gen-api`: rigenera il client tipizzato del web dallo schema OpenAPI dell'API locale.
- `make superadmin`: crea il primo super admin con le credenziali di `secrets.env`.
- `make deploy-check`: verifica che sui progetti Vercel e Supabase siano impostate tutte le variabili necessarie. Il deploy vero avviene con il push su `main`.

---

## Modo di lavorare

1. **Prima di scrivere codice**, leggi il prototipo e produci in `smsg-workspace/docs/`:
   - `architecture.md` con il diagramma dei componenti;
   - `data-model.md` con lo schema ER in Mermaid;
   - `permissions.md` con la matrice completa;
   - `roadmap.md` con le fasi qui sotto.

   Fermati e chiedimi conferma **solo** se trovi una contraddizione in queste istruzioni. Altrimenti procedi.
2. **Fasi**, ciascuna chiusa da test verdi e da un commit (Conventional Commits) in ogni repo toccato:
   1. workspace, scaffolding dei due repo, CI, `make dev` funzionante con una pagina "hello" e un endpoint `/health`;
   2. schema DB, RLS, Auth Hook, bootstrap del super admin, login e protezione per ruolo;
   3. sito pubblico, servizi, prenotazione pubblica;
   4. prenotazioni e assistiti lato staff, libro soci, fatture;
   5. volontari, disponibilità, turni, trasporti, conflitti, notifiche e promemoria;
   6. bacheca con editor a blocchi, media, moderazione;
   7. super admin (ruoli, impostazioni, audit), export GDPR, rifiniture di accessibilità, e2e completi;
   8. guida al deploy in `docs/deploy.md`: collegamento dei due progetti Supabase esistenti (staging e produzione), creazione dei progetti Vercel (api e web) con le variabili per ambiente, Auth Hook e URL di redirect su entrambi i progetti Supabase, dominio, primo super admin.
3. **Alla fine di ogni fase** scrivi un riepilogo breve: cosa funziona, come provarlo, cosa resta.
4. **Dati demo:** usa solo dati di esempio evidenti (per esempio "Mario Rossi (esempio)"). Mai dati realistici inventati spacciati per veri.
5. **Dubbi minori:** se una scelta minore non è coperta da queste istruzioni, prendi la soluzione più semplice e manutenibile e annotala in `docs/decisions.md` come ADR breve.
