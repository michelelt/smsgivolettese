import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { assertPaidOn, romeYear } from '../../lib/dates.js';
import { toCsv, csvDate } from '../../lib/csv.js';
import { Conflict, NotFound } from '../../lib/errors.js';
import { centsToDecimal } from '../../lib/money.js';
import { invoicePdf } from '../../lib/pdf.js';
import { assertTaxCode } from '../../lib/tax-code.js';
import * as repo from './invoices.repo.js';
import type { InvoiceIssue, InvoicesQuery } from './invoices.schemas.js';

export const list = (ctx: Ctx, q: InvoicesQuery) => asUser(ctx, (tx) => repo.list(tx, q));
export const kpis = (ctx: Ctx, year?: number) =>
  asUser(ctx, (tx) => repo.kpis(tx, year ?? romeYear()));

export const get = async (ctx: Ctx, id: string) => {
  const inv = await asUser(ctx, (tx) => repo.detail(tx, id));
  if (!inv) throw new NotFound('Fattura non trovata');
  return inv;
};

/** issue_invoice numbers atomically; the tax code/address typed here are kept on the member by issue_invoice (the address is not). */
export const issue = (ctx: Ctx, input: z.infer<typeof InvoiceIssue>) =>
  asUser(ctx, async (tx) => {
    const taxCode = input.customerTaxCode
      ? assertTaxCode(input.customerTaxCode, input.taxCodeConfirmed)
      : null;
    const address = input.customerAddress || null;
    const id = await repo.issue(tx, {
      transportId: input.transportId,
      amountCents: input.amountCents,
      taxCode,
      address,
      method: input.paymentMethod ?? null,
    });
    return (await repo.detail(tx, id))!;
  });

export const pay = (ctx: Ctx, id: string, method: string, paidOn?: string) =>
  asUser(ctx, async (tx) => {
    if (paidOn) {
      const inv = await repo.detail(tx, id);
      if (!inv) throw new NotFound('Fattura non trovata');
      assertPaidOn(paidOn, inv.issuedOn);
    }
    if ((await repo.pay(tx, id, method, paidOn ?? null)).length === 0) {
      if (!(await repo.exists(tx, id))) throw new NotFound('Fattura non trovata');
      throw new Conflict(
        'Solo una fattura emessa può essere segnata come pagata',
        'INVOICE_NOT_PAYABLE',
      );
    }
    return (await repo.detail(tx, id))!;
  });

export const voidInvoice = (ctx: Ctx, id: string, reason: string) =>
  asUser(ctx, async (tx) => {
    if (!(await repo.exists(tx, id))) throw new NotFound('Fattura non trovata');
    await repo.voidInvoice(tx, id, reason);
    return (await repo.detail(tx, id))!;
  });

export async function pdf(ctx: Ctx, id: string) {
  const i = await get(ctx, id);
  return {
    filename: `fattura-${i.number}-${i.year}.pdf`,
    body: await invoicePdf({ ...i, voidReason: i.voidReason }),
  };
}

const STATUS = { emessa: 'Emessa', pagata: 'Pagata', annullata: 'Annullata' } as const;
const METHOD = { contanti: 'Contanti', pos: 'POS', bonifico: 'Bonifico' } as const;

export async function csv(ctx: Ctx, year = romeYear()) {
  const rows = await asUser(ctx, (tx) => repo.forYear(tx, year));
  return {
    filename: `fatture-${year}.csv`,
    body: toCsv(
      [
        'Numero',
        'Data',
        'Cliente',
        'Codice fiscale',
        'Indirizzo',
        'Imponibile',
        'Bollo',
        'Totale',
        'Stato',
        'Metodo pagamento',
        'Pagata il',
        'Annullata il',
        'Motivo annullamento',
      ],
      rows.map((i) => [
        `${i.number}/${i.year}`,
        csvDate(i.issuedOn),
        i.customerName,
        i.customerTaxCode,
        i.customerAddress,
        centsToDecimal(i.subtotalCents),
        centsToDecimal(i.stampDutyCents),
        centsToDecimal(i.totalCents),
        STATUS[i.status],
        i.paymentMethod ? METHOD[i.paymentMethod] : '',
        csvDate(i.paidOn),
        csvDate(i.voidedOn),
        i.voidReason,
      ]),
    ),
  };
}
