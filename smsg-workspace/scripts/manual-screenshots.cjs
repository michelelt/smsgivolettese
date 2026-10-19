// Takes the screenshots of the user manual (root README.md) from the running `make dev` stack.
// Run through `make manual-shots`: it reloads the demo data first, and this script adds a few
// more demo rows and issues one invoice, so the local database is left dirty on purpose.
// shortcut: PNGs are saved uncompressed (~5 MB total); quantize them to 256 colours before committing, add a step if this gets run often.
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const { chromium } = require(path.join(root, "smsg-web/node_modules/@playwright/test"));
const pg = require(path.join(root, "smsg-api/node_modules/postgres"));

const OUT = path.join(__dirname, "../docs/manual/img");
const BASE = "http://localhost:3000";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PW = "Esempio-Locale-123!"; // demo password from api/supabase/fixtures/demo.sql, local only
const STAFF = "staff.esempio@example.test";
const VOLUNTEER = "volontario.esempio@example.test";
const ADMIN = "admin.esempio@example.test";

// Extra demo rows so the calendars are not empty (same "(esempio)" convention as demo.sql).
const EXTRA = `
insert into public.shifts (shift_type_id, starts_at, ends_at, required_slots)
select id, date_trunc('day', now()) + interval '1 day 14 hours', date_trunc('day', now()) + interval '1 day 17 hours', 1 from public.shift_types where name = 'Centralino';
insert into public.shifts (shift_type_id, starts_at, ends_at, required_slots)
select id, date_trunc('day', now()) + interval '3 days 8 hours', date_trunc('day', now()) + interval '3 days 11 hours', 2 from public.shift_types where name = 'Ambulatorio';
insert into public.shift_assignments (shift_id, volunteer_id, status)
select s.id, 'a0000000-0000-4000-8000-000000000004', 'confermato' from public.shifts s join public.shift_types t on t.id = s.shift_type_id where t.name = 'Centralino';
insert into public.transports (member_id, travel_date, departure_at, from_address, to_address, status, driver_volunteer_id, vehicle_id, contact_phone)
select m.id, current_date + 2, (current_date + 2) + time '14:00', 'Via Esempio 2, Givoletto', 'Poliambulatorio di esempio, Venaria', 'assegnato',
  'a0000000-0000-4000-8000-000000000003', (select id from public.vehicles where plate = 'BB111BB'), '3330000002'
from public.members m where m.last_name = 'Gialli (esempio)';
insert into public.transports (member_id, travel_date, departure_at, from_address, to_address, status)
select m.id, current_date + 3, (current_date + 3) + time '09:15', 'Piazza di esempio, Givoletto', 'Ospedale di esempio', 'richiesto'
from public.members m where m.last_name = 'Esposito (esempio)';
insert into public.availability_rules (volunteer_id, weekday, start_time, end_time, valid_from) values
  ('a0000000-0000-4000-8000-000000000003', 1, '08:00', '12:30', current_date - 7),
  ('a0000000-0000-4000-8000-000000000003', 3, '08:00', '18:00', current_date - 7),
  ('a0000000-0000-4000-8000-000000000003', 5, '14:00', '18:00', current_date - 7),
  ('a0000000-0000-4000-8000-000000000004', 2, '14:00', '19:00', current_date - 7),
  ('a0000000-0000-4000-8000-000000000004', 4, '08:00', '12:30', current_date - 7);
`;

async function shot(page, name, url, opts = {}) {
  // /proponi never reaches networkidle (Turnstile), hence `wait`
  if (url) await page.goto(BASE + url, { waitUntil: opts.wait ?? "networkidle", timeout: 90000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }); // hide the dev badge
  await page.waitForTimeout(opts.delay ?? 600);
  const file = path.join(OUT, `${name}.png`);
  // Viewport only by default: sticky bars land mid-image in full-page shots.
  if (!opts.full) await page.screenshot({ path: file });
  else {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const { width } = page.viewportSize();
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(h, opts.max ?? 1800) } });
  }
  console.log("ok", name);
}

async function as(browser, email, fn, viewport = { width: 1280, height: 960 }) {
  const ctx = await browser.newContext({ viewport, locale: "it-IT" });
  const page = await ctx.newPage();
  try {
    if (email) {
      await page.goto(BASE + "/accedi", { waitUntil: "networkidle" });
      const f = page.getByRole("form", { name: "Entra con la password" });
      await f.getByLabel("Email").fill(email);
      await f.getByLabel("Password").fill(PW);
      await f.getByRole("button", { name: "Entra" }).click();
      await page.waitForURL("**/gestione", { timeout: 60000 });
    }
    await fn(page);
  } finally {
    await ctx.close();
  }
}

(async () => {
  const sql = pg(DB);
  await sql.unsafe(EXTRA);
  const [tr] = await sql`select id from public.transports where status = 'assegnato' limit 1`;
  const [done] = await sql`select id from public.transports where status = 'svolto' limit 1`;
  const [m] = await sql`select id from public.members where last_name = 'Rossi (esempio)'`;
  const [pr] = await sql`select id from public.post_proposals limit 1`;
  const [post] = await sql`select id from public.posts where slug = 'festa-di-esempio'`;
  await sql.end();

  const b = await chromium.launch();
  const phone = { width: 390, height: 844 };

  await as(b, null, async (p) => {
    for (const [n, u] of [["home", "/"], ["chi-siamo", "/chi-siamo"], ["servizi", "/servizi"], ["notizie", "/notizie"],
      ["notizia", "/notizie/gita-di-esempio"], ["convenzioni", "/convenzioni"], ["dove-siamo", "/dove-siamo"]])
      await shot(p, `pub-${n}`, u, { full: true });
    await shot(p, "pub-proponi", "/proponi", { wait: "load", delay: 3000 });
    await shot(p, "accedi", "/accedi");
    await p.goto(BASE + "/chi-siamo", { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "A++" }).click();
    await shot(p, "pub-testo-grande", null);
  });
  await as(b, null, (p) => shot(p, "phone-home", "/", { full: true, max: 1600 }), phone);

  await as(b, STAFF, async (p) => {
    await shot(p, "staff-modifica-pagina", "/chi-siamo");
    await shot(p, "staff-home", "/gestione");
    await p.getByRole("button", { name: "Attività" }).click();
    await shot(p, "staff-menu", null);
    await shot(p, "staff-trasporti", "/gestione/trasporti");
    await shot(p, "staff-trasporto-nuovo", "/gestione/trasporti/nuovo");
    await shot(p, "staff-trasporto", `/gestione/trasporti/${tr.id}`);
    await p.locator("summary", { hasText: "Altro" }).first().click();
    await shot(p, "staff-trasporto-altro", null);
    await shot(p, "staff-trasporto-svolto", `/gestione/trasporti/${done.id}`);
    await p.getByRole("button", { name: "Emetti fattura" }).click();
    await shot(p, "staff-fattura-emetti", null);
    await p.getByRole("dialog").getByRole("button", { name: "Emetti fattura" }).click();
    await p.waitForTimeout(2500);
    await shot(p, "staff-fatture", "/gestione/fatture", { full: true });
    await shot(p, "staff-turni", "/gestione/turni");
    await p.getByRole("button", { name: "Assegna" }).last().click();
    await shot(p, "staff-turni-assegna", null);
    await shot(p, "staff-disponibilita", "/gestione/disponibilita");
    await shot(p, "staff-soci", "/gestione/soci", { full: true });
    await shot(p, "staff-socio-nuovo", "/gestione/soci/nuovo");
    await shot(p, "staff-socio", `/gestione/soci/${m.id}`);
    await shot(p, "staff-volontari", "/gestione/volontari", { full: true });
    await shot(p, "staff-mezzi", "/gestione/mezzi", { full: true });
    await shot(p, "staff-servizi", "/gestione/servizi");
    await shot(p, "staff-impostazioni", "/gestione/impostazioni");
    await shot(p, "staff-sito", "/gestione/sito");
    await shot(p, "staff-bacheca", "/gestione/bacheca", { full: true });
    await shot(p, "staff-bacheca-editor", `/gestione/bacheca/${post.id}`);
    await shot(p, "staff-proposta", `/gestione/bacheca/proposte/${pr.id}`);
  });

  await as(b, VOLUNTEER, async (p) => {
    await shot(p, "vol-home", "/gestione", { full: true });
    await shot(p, "vol-disponibilita", "/gestione/disponibilita");
    await shot(p, "vol-password", "/gestione/account/password");
  });
  await as(b, VOLUNTEER, (p) => shot(p, "vol-phone-home", "/gestione", { full: true, max: 1800 }), phone);

  await as(b, ADMIN, async (p) => {
    await shot(p, "admin-utenti", "/gestione/utenti-e-ruoli", { full: true });
    await shot(p, "admin-registro", "/gestione/registro-attivita");
    await shot(p, "admin-sicurezza", "/gestione/account/sicurezza");
  });
  await b.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
