import * as XLSX from "xlsx";
import { COLUMNS, parseMembersBook, toIsoDate } from "./members-import";

const book = (rows: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Foglio2");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
};
const header = ["", ...COLUMNS];
const row = (o: Partial<Record<string, unknown>>, second?: string) => [
  "",
  ...COLUMNS.map((h, i) => (h === "RIT." && i > 12 ? second : o[h]) ?? ""),
];

describe("parseMembersBook", () => {
  it("maps the member book columns", () => {
    const r = parseMembersBook(
      book([
        header,
        row(
          {
            COGNOME: " Albrile ",
            NOME: "Emilia",
            INDIRIZZO: "Via Castello ",
            "N.": 11,
            CAP: 10040,
            COMUNE: "Val della Torre",
            "DATA N.": 18809,
            "NATO A": "Torino",
            PV: "TO",
            "PAG.": "X",
            "N. CASA": "011 9680667",
            "CELL.": 3382418614,
            "C.F.": "lbrmle51h70l555k",
            MAIL: "A@B.IT",
            CONIUGE: "Da Vià Alberto",
          },
          "SI",
        ),
        [],
        ["", "SOCIO ", "ONORARIO"],
      ]),
      "2026-11-20",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(1);
    expect(r.excelRows).toEqual([2]);
    expect(r.rows[0]).toEqual({
      firstName: "Emilia",
      lastName: "Albrile",
      taxCode: "LBRMLE51H70L555K",
      birthDate: "1951-06-30",
      birthPlace: "Torino (TO)",
      address: "Via Castello 11",
      postalCode: "10040",
      city: "Val della Torre",
      phone: "3382418614",
      email: "a@b.it",
      memberType: "ordinario",
      joinedOn: "2026-11-20",
      notes:
        "Coniuge: Da Vià Alberto\nTel. casa: 011 9680667\nPAG. X · RIT. SI",
    });
  });

  it("explains which columns are missing", () => {
    const r = parseMembersBook(
      book([
        header.filter(
          (h, i) => h !== "MAIL" && h !== "TAGLIA" && !(h === "RIT." && i > 13),
        ),
      ]),
      "2026-11-20",
    );
    expect(r).toEqual({
      ok: false,
      problems: [
        'Manca la colonna "MAIL".',
        'Manca la colonna "TAGLIA".',
        'Manca la seconda colonna "RIT." (nel modello compare due volte).',
      ],
    });
    expect(parseMembersBook(book([["Nome", "Cognome?"]]), "x").ok).toBe(false);
    expect(parseMembersBook(book([header]), "x")).toMatchObject({ ok: false });
  });

  it("reads typed dates and keeps unreadable ones", () => {
    expect(toIsoDate("5//08/1956")).toBe("1956-08-05");
    expect(toIsoDate("03(07/1949")).toBe("1949-07-03");
    expect(toIsoDate("31/02/1950")).toBe("31/02/1950");
    expect(toIsoDate("")).toBeNull();
  });
});
