import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { csvDate, toCsv } from '../../lib/csv.js';
import { assertPaidOn, romeToday, romeYear } from '../../lib/dates.js';
import { Conflict, DomainError, NotFound, ValidationError } from '../../lib/errors.js';
import { centsToDecimal } from '../../lib/money.js';
import { receiptPdf } from '../../lib/pdf.js';
import { assertTaxCode } from '../../lib/tax-code.js';
import * as clients from '../clients/clients.repo.js';
import { orgInfo } from '../settings/settings.repo.js';
import * as repo from './members.repo.js';
import type {
  FeeCreate,
  MemberCreate,
  MemberEnd,
  MemberPatch,
  MembersQuery,
} from './members.schemas.js';

export const list = (ctx: Ctx, q: MembersQuery) => asUser(ctx, (tx) => repo.list(tx, q));
export const kpis = (ctx: Ctx) => asUser(ctx, repo.kpis);

export const get = async (ctx: Ctx, id: string) => {
  const m = await asUser(ctx, (tx) => repo.detail(tx, id));
  if (!m) throw new NotFound('Socio non trovato');
  return m;
};

/** Normalises the tax code (ADR-048); '' clears it. */
const taxOf = (raw: string | null | undefined, confirmed?: boolean) =>
  raw ? assertTaxCode(raw, confirmed) : raw === '' ? null : raw;

/** register_member allocates the card number; linking the client happens in the same transaction. */
export const create = (ctx: Ctx, input: z.infer<typeof MemberCreate>) =>
  asUser(ctx, async (tx) => {
    const { feeMethod, clientId, taxCodeConfirmed, ...f } = input;
    const snake = Object.fromEntries(
      Object.entries(repo.COLS).map(([k, c]) => [c, (f as Record<string, unknown>)[k]]),
    );
    snake.tax_code = taxOf(f.taxCode, taxCodeConfirmed);
    const id = await repo.register(tx, snake, feeMethod ?? null);
    if (clientId && (await clients.linkMember(tx, clientId, id)).length === 0) {
      if (!(await clients.exists(tx, clientId)))
        throw new DomainError(404, 'CLIENT_NOT_FOUND', 'Cliente non trovato');
      throw new Conflict('Il cliente è già collegato a un socio', 'CLIENT_ALREADY_LINKED');
    }
    return (await repo.detail(tx, id))!;
  });

export const update = (ctx: Ctx, id: string, input: z.infer<typeof MemberPatch>) => {
  const { taxCodeConfirmed, ...rest } = input;
  const r = { ...rest, taxCode: taxOf(rest.taxCode, taxCodeConfirmed) };
  if (Object.values(r).every((v) => v === undefined)) throw new ValidationError('Nessuna modifica');
  return asUser(ctx, async (tx) => {
    if ((await repo.update(tx, id, r)).length === 0) throw new NotFound('Socio non trovato');
    return (await repo.detail(tx, id))!;
  });
};

const move = (
  ctx: Ctx,
  id: string,
  run: (tx: Parameters<typeof repo.exists>[0]) => Promise<unknown[]>,
) =>
  asUser(ctx, async (tx) => {
    if ((await run(tx)).length === 0) {
      if (!(await repo.exists(tx, id))) throw new NotFound('Socio non trovato');
      throw new Conflict(
        'Operazione non consentita nello stato attuale',
        'MEMBER_INVALID_TRANSITION',
      );
    }
    return (await repo.detail(tx, id))!;
  });

export const end = (ctx: Ctx, id: string, b: z.infer<typeof MemberEnd>) =>
  move(ctx, id, (tx) => repo.end(tx, id, b.endedOn ?? null, b.endReason));
export const reactivate = (ctx: Ctx, id: string) => move(ctx, id, (tx) => repo.reactivate(tx, id));

export const addFee = (ctx: Ctx, id: string, b: z.infer<typeof FeeCreate>) =>
  asUser(ctx, async (tx) => {
    assertPaidOn(b.paidOn);
    if (!(await repo.exists(tx, id))) throw new NotFound('Socio non trovato');
    return repo.addFee(tx, {
      memberId: id,
      year: b.year ?? null,
      amountCents: b.amountCents ?? null,
      paidOn: b.paidOn ?? null,
      method: b.method,
      by: ctx.user.id,
    });
  });

export const receipt = (ctx: Ctx, id: string, feeId: string) =>
  asUser(ctx, async (tx) => {
    const r = await repo.receiptData(tx, id, feeId);
    if (!r) throw new NotFound('Ricevuta non trovata');
    const o = await orgInfo(tx);
    return {
      filename: `ricevuta-quota-${r.year}-tessera-${r.cardNumber}.pdf`,
      body: await receiptPdf({
        issuerName: o.legalName,
        issuerTaxCode: o.taxCode,
        issuerAddress: o.address,
        memberName: `${r.firstName} ${r.lastName}`,
        memberTaxCode: r.taxCode,
        cardNumber: r.cardNumber,
        year: r.year,
        amountCents: r.amountCents,
        paidOn: r.paidOn,
        method: r.method,
      }),
    };
  });

const TYPE = {
  ordinario: 'Ordinario',
  familiare: 'Familiare',
  sostenitore: 'Sostenitore',
  onorario: 'Onorario',
} as const;
const REASON = {
  dimissioni: 'Dimissioni',
  decesso: 'Decesso',
  mancato_pagamento: 'Mancato pagamento',
  esclusione: 'Esclusione',
  trasferimento: 'Trasferimento',
} as const;

export async function csv(ctx: Ctx) {
  const rows = await asUser(ctx, repo.exportRows);
  return {
    filename: `libro-soci-${romeToday()}.csv`,
    body: toCsv(
      [
        'Tessera',
        'Cognome',
        'Nome',
        'Codice fiscale',
        'Data nascita',
        'Luogo nascita',
        'Indirizzo',
        'CAP',
        'Comune',
        'Telefono',
        'Email',
        'Data iscrizione',
        'Tipo',
        'Stato',
        'Cessato il',
        'Motivo',
        `Quota ${romeYear()}`,
        'Privacy firmata il',
      ],
      rows.map((m) => [
        m.cardNumber,
        m.lastName,
        m.firstName,
        m.taxCode,
        csvDate(m.birthDate),
        m.birthPlace,
        m.address,
        m.postalCode,
        m.city,
        m.phone,
        m.email,
        csvDate(m.joinedOn),
        TYPE[m.memberType],
        m.status === 'attivo' ? 'Attivo' : 'Cessato',
        csvDate(m.endedOn),
        m.endReason ? REASON[m.endReason] : '',
        m.currentFeeCents == null ? '' : centsToDecimal(m.currentFeeCents),
        csvDate(m.privacySignedOn),
      ]),
    ),
  };
}
