import { describe, expect, it } from 'vitest';
import { overlapping } from '../me/me.service.js';
import { TRANSPORT_CSV_HEADER, transportsCsv } from './transports.service.js';

describe('transports csv (ADR-055)', () => {
  it('has the agreed columns and formats', () => {
    const out = transportsCsv([
      {
        travelDate: '2026-10-05',
        departureTime: '08:30',
        memberName: 'Anna Verdi',
        fromAddress: 'Via Roma 1',
        toAddress: 'Ospedale',
        driverName: 'Mario Rossi',
        vehiclePlate: 'AB123CD',
        odometerStart: 1000,
        odometerEnd: 1012,
        km: 12,
        wheelchair: true,
        mobilityAids: false,
        companions: 1,
        driverNotes: '+39 333 1234567',
      },
    ]);
    const [h, r] = out.replace('﻿', '').split('\r\n');
    expect(h).toBe(TRANSPORT_CSV_HEADER.map((c) => `"${c}"`).join(';'));
    expect(TRANSPORT_CSV_HEADER).toHaveLength(14);
    expect(r).toBe(
      '"05/10/2026";"08:30";"Anna Verdi";"Via Roma 1";"Ospedale";"Mario Rossi";"AB123CD";"1000";"1012";"12";"Sì";"No";"1";"+39 333 1234567"',
    );
  });
});

describe('availability overlap check', () => {
  const r = (weekday: number, startTime: string, endTime: string) => ({
    weekday,
    startTime,
    endTime,
  });
  it('flags same-day overlaps only', () => {
    expect(overlapping([r(1, '08:00', '12:00'), r(1, '11:00', '13:00')])).toBe(true);
    expect(overlapping([r(1, '08:00', '12:00'), r(1, '12:00', '13:00')])).toBe(false);
    expect(overlapping([r(1, '08:00', '12:00'), r(2, '08:00', '12:00')])).toBe(false);
  });
});
