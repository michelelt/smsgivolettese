import { Unprocessable, ValidationError } from './errors.js';

export const normalizeTaxCode = (s: string) => s.replace(/\s/g, '').toUpperCase();
/** Hard rule, equal to the DB check. */
export const hasTaxCodeShape = (s: string) => /^[A-Z0-9]{16}$/.test(s);

// Omocodia: digits at positions 7,8,10,11,13,14,15 may be replaced by LMNPQRSTUV.
const D = '[0-9LMNPQRSTUV]';
const LAYOUT = new RegExp(`^[A-Z]{6}${D}{2}[ABCDEHLMPRST]${D}{2}[A-Z]${D}{3}[A-Z]$`);
const ODD = [
  1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23,
];
const idx = (ch: string) =>
  ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 65;

/** Official layout (incl. omocodia) and check character. Input already normalised. */
export function isTaxCodeValid(s: string) {
  if (!LAYOUT.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) sum += i % 2 === 0 ? ODD[idx(s[i]!)]! : idx(s[i]!);
  return String.fromCharCode(65 + (sum % 26)) === s[15];
}

/** Returns the normalised code or throws: 400 on the hard rule, 422 TAX_CODE_INVALID unless confirmed (ADR-048). */
export function assertTaxCode(raw: string, confirmed?: boolean) {
  const code = normalizeTaxCode(raw);
  if (!hasTaxCodeShape(code))
    throw new ValidationError('Il codice fiscale deve avere 16 caratteri', [
      { path: 'taxCode', message: 'Formato non valido' },
    ]);
  if (!confirmed && !isTaxCodeValid(code))
    throw new Unprocessable(
      'Il codice fiscale sembra errato, controlla o conferma',
      'TAX_CODE_INVALID',
      {
        field: 'taxCode',
      },
    );
  return code;
}
