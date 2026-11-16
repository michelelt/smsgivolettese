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

export type ProformaPdf = {
  issuerName: string;
  issuerTaxCode: string | null;
  issuerAddress: string | null;
  memberName: string;
  travelDate: string;
  departureTime: string | null;
  returnTime: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  km: number | null;
  driverName: string | null;
  bandLabel: string | null;
  bandColor: string | null;
};

/** Pro forma (ADR-075): service summary for the member. No price, no tax data. */
export const proformaPdf = (p: ProformaPdf) =>
  render((d) => {
    d.font('Sans-Bold').fontSize(16).text(p.issuerName);
    d.font('Sans').fontSize(10);
    if (p.issuerAddress) d.text(p.issuerAddress);
    if (p.issuerTaxCode) d.text(`C.F. ${p.issuerTaxCode}`);
    d.moveDown(2);
    d.font('Sans-Bold').fontSize(14).text('Riepilogo del servizio');
    d.font('Sans')
      .fontSize(9)
      .text('Pro forma - documento non fiscale, promemoria del servizio svolto.');
    d.moveDown();
    d.fontSize(11);
    const f = (k: string, v: string | number | null) => v !== null && d.text(`${k}: ${v}`);
    f('Socio', p.memberName);
    f('Data', dmy(p.travelDate));
    f('Partenza', p.departureTime);
    f('Ritorno', p.returnTime);
    f('Da', p.fromAddress);
    f('A', p.toAddress);
    f('Km percorsi', p.km);
    f('Autista', p.driverName);
    if (p.bandColor) {
      d.moveDown();
      const y = d.y;
      d.circle(58, y + 7, 7)
        .fill(p.bandColor)
        .fillColor('black');
      d.text(p.bandLabel ?? '', 72, y, { lineBreak: false });
    }
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
  contactPhone: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  wheelchair: boolean;
  mobilityAids: boolean;
  companions: number;
  driverName: string | null;
  vehicle: string | null;
};

/** Trip sheet (ADR-055): volunteer-minimal fields only, no staff notes; Km/Note/Firma left blank. */
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
    f('Socio', t.memberName);
    f('Telefono', t.contactPhone);
    f('Partenza', t.departureTime);
    f('Appuntamento', t.appointmentTime);
    f('Ritorno', t.returnTime);
    f('Da', t.fromAddress);
    f('A', t.toAddress);
    f('Carrozzina', t.wheelchair ? 'Sì' : 'No');
    f('Ausili (deambulatore/stampelle)', t.mobilityAids ? 'Sì' : 'No');
    f('Accompagnatori', String(t.companions));
    d.moveDown(2);
    d.text('Km partenza ____________   Km arrivo ____________');
    d.moveDown(1.5);
    d.text('Note ______________________________________________');
    d.moveDown(1.5);
    d.text('Firma ______________________');
  });
