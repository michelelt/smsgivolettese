import { describe, expect, it } from 'vitest';
import { BookingInput, normalizePhone } from './public.schemas.js';

const base = {
  serviceId: 'fa000000-0000-4000-8000-000000000001',
  day: '2030-01-01',
  slot: 'mattina',
  firstName: 'Anna',
  lastName: 'Rossi',
  declaredMember: false,
  turnstileToken: 't',
};
const parse = (phone: string) => BookingInput.safeParse({ ...base, phone });

describe('phone', () => {
  it.each([
    ['+39 333 123 4567', '3331234567'],
    ['0039 333.123-4567', '3331234567'],
    ['(0141) 90 12 34', '014190 1234'.replace(' ', '')],
  ])('normalises %s', (raw, want) => {
    expect(normalizePhone(raw)).toBe(want);
    expect(parse(raw).success).toBe(true);
  });
  it.each(['12345', '+39 133 123 4567', 'abc', '333 12', '03331'])('rejects %s', (raw) => {
    expect(parse(raw).success).toBe(false);
  });
  it('passes the national form to the handler', () => {
    expect(parse('+39 333 1234567').data?.phone).toBe('3331234567');
  });
});

describe('notes', () => {
  it('rejects > 600 chars', () => {
    expect(
      BookingInput.safeParse({ ...base, phone: '3331234567', notes: 'x'.repeat(601) }).success,
    ).toBe(false);
  });
});
