export type Cell = string | number | null | undefined;

/** Cells that Excel/LibreOffice would evaluate as formulas get a leading apostrophe , except phone numbers like "+39 333 1234567" (ADR-050). */
const guard = (s: string) => (/^[=+\-@\t\r]/.test(s) && !/^\+[\d\s]+$/.test(s) ? `'${s}` : s);
const quote = (c: Cell) => `"${guard(c == null ? '' : String(c)).replaceAll('"', '""')}"`;

/** UTF-8 BOM, `;` separator, CRLF, every field quoted. */
export const toCsv = (header: string[], rows: Cell[][]) =>
  '﻿' + [header, ...rows].map((r) => r.map(quote).join(';')).join('\r\n') + '\r\n';

/** 'YYYY-MM-DD' (or ISO timestamp) -> 'dd/mm/yyyy'. */
export const csvDate = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
