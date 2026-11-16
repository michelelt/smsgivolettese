import { describe, expect, it } from 'vitest';
import { proformaPdf, receiptPdf, transportSheetPdf } from './pdf.js';

describe('pdf', () => {
  it('renders a pro forma, with and without band', async () => {
    for (const band of [
      { bandLabel: 'Verde', bandColor: '#2E7D32' },
      { bandLabel: null, bandColor: null },
    ]) {
      const buf = await proformaPdf({
        issuerName: 'Società',
        issuerTaxCode: '123',
        issuerAddress: 'Via Roma 1',
        memberName: 'Mario Rossi',
        travelDate: '2026-03-07',
        departureTime: '08:30',
        returnTime: null,
        fromAddress: 'Via Roma 1',
        toAddress: 'Ospedale',
        km: 12,
        driverName: 'Luca Bianchi',
        ...band,
      });
      expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    }
  });
  it('renders a fee receipt', async () => {
    const buf = await receiptPdf({
      issuerName: 'Società',
      issuerTaxCode: null,
      issuerAddress: null,
      memberName: 'Mario Rossi',
      memberTaxCode: null,
      cardNumber: 12,
      year: 2026,
      amountCents: 2000,
      paidOn: '2026-01-05',
      method: 'contanti',
    });
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });
  it('embeds a TTF so ș ł ğ render', async () => {
    const buf = await receiptPdf({
      issuerName: 'Società',
      issuerTaxCode: null,
      issuerAddress: null,
      memberName: 'Ștefan Łukasz Doğan',
      memberTaxCode: null,
      cardNumber: 1,
      year: 2026,
      amountCents: 2000,
      paidOn: '2026-01-05',
      method: 'pos',
    });
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.toString('latin1')).toMatch(/\/FontFile2/);
    expect(buf.toString('latin1')).toMatch(/DejaVuSans/);
  });

  it('renders the trip sheet with odometer blanks', async () => {
    const buf = await transportSheetPdf({
      travelDate: '2026-10-05',
      departureTime: '08:30',
      appointmentTime: '09:30',
      returnTime: null,
      memberName: 'Anna Verdi',
      contactPhone: '333 1234567',
      fromAddress: 'Via Roma 1',
      toAddress: 'Ospedale',
      wheelchair: false,
      mobilityAids: true,
      companions: 1,
      driverName: null,
      vehicle: null,
    });
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
