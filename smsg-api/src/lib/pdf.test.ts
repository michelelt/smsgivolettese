import { describe, expect, it } from 'vitest';
import { invoicePdf, receiptPdf, type InvoicePdf } from './pdf.js';

describe('pdf', () => {
  it('renders an invoice, void and paid, as a PDF', async () => {
    const base: Omit<InvoicePdf, 'status'> = {
      year: 2026,
      number: 7,
      issuedOn: '2026-03-07',
      issuerName: 'Società',
      issuerTaxCode: '123',
      issuerAddress: 'Via Roma 1',
      customerName: 'Mario Rossi',
      customerTaxCode: null,
      customerAddress: null,
      lines: [{ description: 'Pedicure del 07/03/2026', amountCents: 5000 }],
      subtotalCents: 5000,
      stampDutyCents: 200,
      totalCents: 5200,
      vatExemptionText: 'Esente IVA',
      paymentMethod: null,
      paidOn: null,
      voidReason: null,
    };
    for (const extra of [
      { status: 'emessa' },
      { status: 'pagata', paymentMethod: 'pos', paidOn: '2026-03-08' },
      { status: 'annullata', voidReason: 'Errore' },
    ] as const) {
      const buf = await invoicePdf({ ...base, ...extra });
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
});
