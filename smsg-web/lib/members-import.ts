import * as XLSX from "xlsx";
import type { components } from "@/lib/api/schema";

export type MemberType = components["schemas"]["Member"]["memberType"];
export type Draft = {
  firstName: string;
  lastName: string;
  taxCode: string | null;
  taxCodeConfirmed?: boolean;
  birthDate: string | null;
  birthPlace: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  memberType: MemberType;
  joinedOn: string;
  notes: string | null;
};
export type Parsed =
  | { ok: true; rows: Draft[]; excelRows: number[] }
  | { ok: false; problems: string[] };

/** Columns of the association's member book (Excel), in file order. "RIT." appears twice. */
export const COLUMNS = [
  "COGNOME",
  "NOME",
  "INDIRIZZO",
  "N.",
  "CAP",
  "COMUNE",
  "DATA N.",
  "NATO A",
  "PV",
  "PAG.",
  "ORD.",
  "RIT.",
  "N. CASA",
  "CELL.",
  "C.F.",
  "CARICA",
  "MAIL",
  "TAGLIA",
  "RIT.",
  "CONIUGE",
  "SCADENZA P.",
] as const;

const TYPES: Record<string, MemberType> = {
  ORDINARIO: "ordinario",
  ORDINARIA: "ordinario",
  FAMILIARE: "familiare",
  SOSTENITORE: "sostenitore",
  SOSTENITRICE: "sostenitore",
  ONORARIO: "onorario",
  ONORARIA: "onorario",
};
const LEGEND = /^SOCI[OA]\s+([A-Z]+)$/;

const norm = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
const text = (v: unknown) => String(v ?? "").trim();
const orNull = (s: string) => (s === "" ? null : s);
const pad = (n: number) => String(n).padStart(2, "0");

/** Excel serial or typed text ("5//08/1956", "03(07/1949") -> YYYY-MM-DD; unreadable text is kept for the staff to fix. */
export function toIsoDate(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : String(v);
  }
  const parts = String(v).split(/\D+/).filter(Boolean).map(Number);
  if (parts.length === 3) {
    const [d, m, y] = parts as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      y > 1900 &&
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    )
      return `${y}-${pad(m)}-${pad(d)}`;
  }
  return text(v);
}

const fill = (c: XLSX.CellObject | undefined) =>
  (c?.s as { patternType?: string; fgColor?: { rgb?: string } } | undefined)
    ?.patternType === "solid"
    ? (c!.s as { fgColor?: { rgb?: string } }).fgColor?.rgb?.toUpperCase()
    : undefined;

/** Reads the first sheet of the member book; member type comes from the fill colour legend ("SOCIO ONORARIO") under the table. */
export function parseMembersBook(data: ArrayBuffer, joinedOn: string): Parsed {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(new Uint8Array(data), { type: "array", cellStyles: true });
  } catch {
    return {
      ok: false,
      problems: [
        "Il file non è un foglio Excel leggibile (.xls, .xlsx o .ods).",
      ],
    };
  }
  const ws = wb.Sheets[wb.SheetNames[0]!];
  if (!ws?.["!ref"])
    return { ok: false, problems: ["Il primo foglio del file è vuoto."] };
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const cell = (r: number, c: number) =>
    ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;

  // Header: first of the top 10 rows that contains COGNOME.
  let hr = -1;
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 9); r++)
    for (let c = range.s.c; c <= range.e.c; c++)
      if (norm(cell(r, c)?.v) === "COGNOME") hr = r;
  if (hr < 0)
    return {
      ok: false,
      problems: [
        'Non trovo la riga di intestazione: nelle prime 10 righe del primo foglio deve esserci una cella "COGNOME".',
      ],
    };

  // Map each expected column (duplicates by occurrence) to its index.
  const col = new Map<string, number>();
  const seen: Record<string, number> = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = norm(cell(hr, c)?.v);
    if (!h) continue;
    const k = `${h}#${(seen[h] = (seen[h] ?? 0) + 1)}`;
    if (!col.has(k)) col.set(k, c);
  }
  const want: Record<string, number> = {};
  const keys = COLUMNS.map((h) => `${h}#${(want[h] = (want[h] ?? 0) + 1)}`);
  const missing = keys.filter((k) => !col.has(k));
  if (missing.length)
    return {
      ok: false,
      problems: missing.map((k) => {
        const [h, n] = k.split("#");
        return n === "1"
          ? `Manca la colonna "${h}".`
          : `Manca la seconda colonna "${h}" (nel modello compare due volte).`;
      }),
    };
  const at = (r: number, k: string) => cell(r, col.get(k)!)?.v;

  // Every non-empty row is a member except the colour legend ("SOCIO ONORARIO"): odd rows show up as errors, never dropped silently.
  const body: number[] = [];
  const legend = new Map<string, MemberType>();
  for (let r = hr + 1; r <= range.e.r; r++) {
    const vals = keys.map((k) => text(at(r, k)));
    const isLegend = LEGEND.exec(
      norm(`${vals[0]} ${vals[1]}`),
    )?.[1] as keyof typeof TYPES;
    if (isLegend && TYPES[isLegend]) {
      const rgb = fill(cell(r, col.get("COGNOME#1")!));
      if (rgb) legend.set(rgb, TYPES[isLegend]!);
      continue;
    }
    if (vals.some((v) => v !== "")) body.push(r);
  }
  if (body.length === 0)
    return {
      ok: false,
      problems: [
        "Il file ha le colonne giuste ma nessun socio sotto l'intestazione.",
      ],
    };

  const rows = body.map((r): Draft => {
    const v = (k: string) => text(at(r, k));
    const pv = v("PV#1");
    const nato = v("NATO A#1");
    const cap = at(r, "CAP#1");
    const cell1 = at(r, "CELL.#1");
    const casa = v("N. CASA#1");
    const mobile =
      typeof cell1 === "number" ? String(Math.round(cell1)) : text(cell1);
    const scad = toIsoDate(at(r, "SCADENZA P.#1"));
    const notes = [
      v("CONIUGE#1") && `Coniuge: ${v("CONIUGE#1")}`,
      v("CARICA#1") && `Carica: ${v("CARICA#1")}`,
      v("TAGLIA#1") && `Taglia: ${v("TAGLIA#1")}`,
      mobile && casa && `Tel. casa: ${casa}`,
      scad && `Scadenza P.: ${scad.split("-").reverse().join("/")}`,
      // Flags kept as written: their meaning is known to the staff, not to the app.
      ["PAG.#1", "ORD.#1", "RIT.#1", "RIT.#2"]
        .filter((k) => v(k))
        .map((k) => `${k.split("#")[0]} ${v(k)}`)
        .join(" · "),
    ].filter(Boolean);
    return {
      firstName: v("NOME#1"),
      lastName: v("COGNOME#1"),
      taxCode: orNull(v("C.F.#1").replace(/\s/g, "").toUpperCase()),
      birthDate: toIsoDate(at(r, "DATA N.#1")),
      birthPlace: orNull(nato && pv && pv !== "EE" ? `${nato} (${pv})` : nato),
      address: orNull([v("INDIRIZZO#1"), v("N.#1")].filter(Boolean).join(" ")),
      postalCode: orNull(
        typeof cap === "number" ? String(cap).padStart(5, "0") : text(cap),
      ),
      city: orNull(v("COMUNE#1")),
      phone: orNull(mobile || casa),
      email: orNull(v("MAIL#1").toLowerCase()),
      memberType:
        legend.get(fill(cell(r, col.get("COGNOME#1")!)) ?? "") ?? "ordinario",
      joinedOn,
      notes: orNull(notes.join("\n")),
    };
  });
  return { ok: true, rows, excelRows: body.map((r) => r + 1) };
}
