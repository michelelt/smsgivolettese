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

describe('fromPostgres phase 4', () => {
  it('maps unique violations by constraint name', () => {
    for (const [c, code] of [
      ['members_tax_code_key', 'MEMBER_TAX_CODE_EXISTS'],
      ['membership_fees_member_id_year_key', 'FEE_ALREADY_PAID'],
      ['clients_member_id_key', 'CLIENT_ALREADY_LINKED'],
      ['other_key', 'DUPLICATE'],
    ] as const)
      expect(fromPostgres({ code: '23505', constraint_name: c })).toMatchObject({
        status: 409,
        code,
      });
  });
  it('maps check violations to 400 and the new raise codes', () => {
    expect(fromPostgres({ code: '23514' })).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(fromPostgres({ code: 'P0001', message: 'CLIENT_NOT_FOUND' })?.status).toBe(404);
    expect(fromPostgres({ code: 'P0001', message: 'VOID_REASON_REQUIRED' })?.status).toBe(400);
    expect(fromPostgres({ code: 'P0001', message: 'CARD_NUMBER_IMMUTABLE' })?.status).toBe(409);
  });
});
