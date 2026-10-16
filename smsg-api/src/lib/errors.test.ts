import { describe, expect, it } from 'vitest';
import { fromPostgres } from './errors.js';

describe('fromPostgres mapping', () => {
  it('maps overlap, privilege and raise codes to statuses', () => {
    expect(fromPostgres({ code: '23P01' })).toMatchObject({
      status: 409,
      code: 'COMMITMENT_OVERLAP',
    });
    expect(fromPostgres({ code: '42501' })?.status).toBe(403);
    expect(fromPostgres({ code: 'P0001', message: 'TRANSPORT_NOT_FOUND' })?.status).toBe(404);
    expect(fromPostgres({ code: 'P0001', message: 'INVALID_INPUT' })?.status).toBe(400);
  });
});

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
