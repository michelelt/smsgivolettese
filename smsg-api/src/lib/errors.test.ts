import { describe, expect, it } from 'vitest';
import { fromPostgres } from './errors.js';

describe('fromPostgres P0001', () => {
  it('keeps allowlisted codes', () => {
    expect(fromPostgres({ code: 'P0001', message: 'LAST_SUPER_ADMIN' })?.code).toBe(
      'LAST_SUPER_ADMIN',
    );
  });
  it('falls back to CONFLICT for unknown messages', () => {
    const e = fromPostgres({ code: 'P0001', message: 'secret internal text' });
    expect(e?.code).toBe('CONFLICT');
  });
});
