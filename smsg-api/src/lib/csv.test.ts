import { describe, expect, it } from 'vitest';
import { csvDate, toCsv } from './csv.js';
import { centsToDecimal, formatEuro } from './money.js';

describe('csv', () => {
  it('writes BOM, ; separator, CRLF and quotes every field', () => {
    const out = toCsv(
      ['A', 'B'],
      [
        ['x;y', 'say "hi"'],
        [1, null],
      ],
    );
    expect(out.startsWith('﻿"A";"B"\r\n')).toBe(true);
    expect(out).toBe('﻿"A";"B"\r\n"x;y";"say ""hi"""\r\n"1";""\r\n');
  });
  it('neutralises formula injection', () => {
    const out = toCsv(
      ['c'],
      [
        ['=1+1'],
        ['+39333'],
        ['+39 333 1234567'],
        ['+39a'],
        ['-2'],
        ['@SUM(A1)'],
        ['\tx'],
        ['\rx'],
        ['ok=1'],
      ],
    );
    expect(out).toContain('"\'=1+1"');
    expect(out).toContain('"+39333"');
    expect(out).toContain('"+39 333 1234567"');
    expect(out).toContain('"\'+39a"');
    expect(out).toContain('"\'-2"');
    expect(out).toContain('"\'@SUM(A1)"');
    expect(out).toContain('"\'\tx"');
    expect(out).toContain('"ok=1"');
  });
  it('formats dates and amounts', () => {
    expect(csvDate('2026-03-07')).toBe('07/03/2026');
    expect(csvDate('2026-03-07T10:00:00.000Z')).toBe('07/03/2026');
    expect(csvDate(null)).toBe('');
    expect(centsToDecimal(123450)).toBe('1234,50');
    expect(centsToDecimal(5)).toBe('0,05');
    expect(formatEuro(123450)).toMatch(/1234,50/);
  });
});
