import { describe, expect, it } from 'vitest';
import { assertTaxCode, hasTaxCodeShape, isTaxCodeValid, normalizeTaxCode } from './tax-code.js';

const VALID = 'RSSMRA85T10A562S';
const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

describe('tax code', () => {
  it('normalises and checks the hard shape', () => {
    expect(normalizeTaxCode(' rssmra 85t10a562s ')).toBe(VALID);
    expect(hasTaxCodeShape(VALID)).toBe(true);
    expect(hasTaxCodeShape('RSSMRA85T10A562')).toBe(false);
    expect(hasTaxCodeShape('RSSMRA85T10A562-')).toBe(false);
  });
  it('accepts a valid code and rejects a wrong check character', () => {
    expect(isTaxCodeValid(VALID)).toBe(true);
    expect(isTaxCodeValid('RSSMRA85T10A562T')).toBe(false);
  });
  it('accepts omocodia (letters in digit slots) with the matching check character', () => {
    const prefix = 'RSSMRA85T10A56N'; // last digit 2 -> N
    expect(letters.filter((c) => isTaxCodeValid(prefix + c))).toHaveLength(1);
    expect(isTaxCodeValid('RSSMRA85T10A56N' + 'S')).toBe(false); // the plain code's check char is not the omocode's
  });
  it('rejects a layout that is 16 alphanumerics but not a tax code', () => {
    expect(isTaxCodeValid('1234567890123456')).toBe(false);
    expect(isTaxCodeValid('RSSMRA85Z10A562S')).toBe(false); // month letter Z
  });
  it('assertTaxCode: 400 on shape, 422 unless confirmed', () => {
    expect(assertTaxCode(' rssmra85t10a562s ')).toBe(VALID);
    expect(() => assertTaxCode('abc')).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => assertTaxCode('RSSMRA85T10A562T')).toThrow(
      expect.objectContaining({
        status: 422,
        code: 'TAX_CODE_INVALID',
        details: { field: 'taxCode' },
      }),
    );
    expect(assertTaxCode('RSSMRA85T10A562T', true)).toBe('RSSMRA85T10A562T');
  });
});
