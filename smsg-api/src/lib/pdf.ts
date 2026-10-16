import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { formatEuro } from './money.js';

// ADR-049: embedded DejaVu Sans (full Latin Extended), A4, rendered per request.
// Literal `new URL(..., import.meta.url)` inside readFileSync lets Vercel's file tracer bundle the fonts.
const font = (f: string) => readFileSync(new URL(`../../assets/fonts/${f}`, import.meta.url));
const FONTS = { Sans: font('DejaVuSans.ttf'), 'Sans-Bold': font('DejaVuSans-Bold.ttf') };
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const METHOD = { contanti: 'Contanti', pos: 'POS', bonifico: 'Bonifico' } as const;

function render(draw: (d: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const d = new PDFDocument({ size: 'A4', margin: 50 });
    for (const [n, b] of Object.entries(FONTS)) d.registerFont(n, b);
    const chunks: Buffer[] = [];
    d.on('data', (c: Buffer) => chunks.push(c));
    d.on('end', () => resolve(Buffer.concat(chunks)));
    d.on('error', reject);
    draw(d);
    d.end();
  });
}

const row = (d: PDFKit.PDFDocument, left: string, right: string, bold = false) => {
  const y = d.y;
  d.font(bold ? 'Sans-Bold' : 'Sans').text(left, 50, y, { width: 380 });
  d.text(right, 440, y, { width: 105, align: 'right' });
  d.moveDown(0.3);
};

export type InvoicePdf = {
  year: number;
  number: number;
  issuedOn: string;
  issuerName: string;
  issuerTaxCode: string | null;
  issuerAddress: string | null;
  customerName: string;
  customerTaxCode: string | null;
  customerAddress: string | null;
  lines: { description: string; amountCents: number }[];
  subtotalCents: number;
  stampDutyCents: number;
  totalCents: number;
  vatExemptionText: string;
  status: 'emessa' | 'pagata' | 'annullata';
  paymentMethod: keyof typeof METHOD | null;
  paidOn: string | null;
  voidReason: string | null;
};

/** Uses only the invoice snapshot, never live org data. */
export const invoicePdf = (i: InvoicePdf) =>
  render((d) => {
    d.font('Sans-Bold').fontSize(16).text(i.issuerName);
    d.font('Sans').fontSize(10);
    if (i.issuerAddress) d.text(i.issuerAddress);
    if (i.issuerTaxCode) d.text(`C.F. ${i.issuerTaxCode}`);
    d.moveDown();
    if (i.status === 'annullata')
      d.font('Sans-Bold').fontSize(18).fillColor('#B00020').text('ANNULLATA').fillColor('black');
    d.font('Sans-Bold').fontSize(14).text(`Fattura n. ${i.number}/${i.year}`);
    d.font('Sans')
      .fontSize(10)
      .text(`Data: ${dmy(i.issuedOn)}`);
    if (i.status === 'annullata' && i.voidReason) d.text(`Motivo annullamento: ${i.voidReason}`);
    d.moveDown();
    d.font('Sans-Bold').text('Cliente');
    d.font('Sans').text(i.customerName);
    if (i.customerAddress) d.text(i.customerAddress);
    if (i.customerTaxCode) d.text(`C.F. ${i.customerTaxCode}`);
    d.moveDown();
    for (const l of i.lines) row(d, l.description, formatEuro(l.amountCents));
    d.moveDown(0.5);
    row(d, 'Totale prestazioni (esente IVA)', formatEuro(i.subtotalCents));
    if (i.stampDutyCents > 0) row(d, 'Imposta di bollo', formatEuro(i.stampDutyCents));
    row(d, 'Totale', formatEuro(i.totalCents), true);
    d.moveDown();
    d.font('Sans').fontSize(9).text(i.vatExemptionText);
    if (i.stampDutyCents > 0) d.text('Imposta di bollo assolta in modo virtuale.');
    d.moveDown();
    d.fontSize(10).text(
      i.status === 'pagata' && i.paymentMethod && i.paidOn
        ? `Pagata il ${dmy(i.paidOn)} - ${METHOD[i.paymentMethod]}`
        : 'Pagamento: da incassare',
    );
  });

export type ReceiptPdf = {
  issuerName: string;
  issuerTaxCode: string | null;
  issuerAddress: string | null;
  memberName: string;
  memberTaxCode: string | null;
  cardNumber: number;
  year: number;
  amountCents: number;
  paidOn: string;
  method: keyof typeof METHOD;
};

/** Fee receipt with the issuer data current at render time. */
export const receiptPdf = (r: ReceiptPdf) =>
  render((d) => {
    d.font('Sans-Bold').fontSize(16).text(r.issuerName);
    d.font('Sans').fontSize(10);
    if (r.issuerAddress) d.text(r.issuerAddress);
    if (r.issuerTaxCode) d.text(`C.F. ${r.issuerTaxCode}`);
    d.moveDown(2);
    d.font('Sans-Bold').fontSize(14).text(`Ricevuta quota associativa ${r.year}`);
    d.moveDown();
    d.font('Sans')
      .fontSize(11)
      .text(
        `Si dichiara di aver ricevuto da ${r.memberName}${r.memberTaxCode ? `, C.F. ${r.memberTaxCode}` : ''}, ` +
          `socio con tessera n. ${r.cardNumber}, la somma di`,
      );
    d.moveDown(0.5);
    d.font('Sans-Bold').fontSize(20).text(formatEuro(r.amountCents));
    d.moveDown(0.5);
    d.font('Sans')
      .fontSize(11)
      .text(
        `a titolo di quota associativa per l'anno ${r.year}, versata il ${dmy(r.paidOn)} (${METHOD[r.method]}).`,
      );
    d.moveDown();
    d.fontSize(9).text('Quota associativa non soggetta a IVA (art. 4 D.P.R. 633/1972).');
    d.moveDown(3);
    d.fontSize(11).text('Firma ______________________');
  });

export type TransportSheet = {
  travelDate: string;
  departureTime: string | null;
  appointmentTime: string | null;
  returnTime: string | null;
  memberName: string;
  memberPhone: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  wheelchair: boolean;
  companion: boolean;
  driverName: string | null;
  vehicle: string | null;
};

/** Trip sheet (ADR-055): volunteer-minimal fields only, no reason or staff notes; Km/Note/Firma left blank. */
export const transportSheetPdf = (t: TransportSheet) =>
  render((d) => {
    d.font('Sans-Bold')
      .fontSize(16)
      .text(`Foglio di viaggio del ${dmy(t.travelDate)}`);
    d.moveDown();
    d.font('Sans').fontSize(11);
    const f = (k: string, v: string | null) => v && d.text(`${k}: ${v}`);
    f('Autista', t.driverName);
    f('Mezzo', t.vehicle);
    d.moveDown(0.5);
    f('Assistito', t.memberPhone ? `${t.memberName} (${t.memberPhone})` : t.memberName);
    f('Partenza', t.departureTime);
    f('Appuntamento', t.appointmentTime);
    f('Ritorno', t.returnTime);
    f('Da', t.fromAddress);
    f('A', t.toAddress);
    f('Carrozzina', t.wheelchair ? 'Sì' : 'No');
    f('Accompagnatore', t.companion ? 'Sì' : 'No');
    d.moveDown(2);
    d.text('Km ______________');
    d.moveDown(1.5);
    d.text('Note ______________________________________________');
    d.moveDown(1.5);
    d.text('Firma ______________________');
  });
