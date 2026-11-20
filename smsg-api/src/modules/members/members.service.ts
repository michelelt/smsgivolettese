import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { csvDate, toCsv } from '../../lib/csv.js';
import { assertPaidOn, romeToday, romeYear } from '../../lib/dates.js';
import { Conflict, DomainError, NotFound, ValidationError } from '../../lib/errors.js';
import { centsToDecimal } from '../../lib/money.js';
import { receiptPdf } from '../../lib/pdf.js';
import { assertTaxCode } from '../../lib/tax-code.js';
import { orgInfo } from '../settings/settings.repo.js';
import * as repo from './members.repo.js';
import { MemberImportRow } from './members.schemas.js';
import type {
  FeeCreate,
  MemberCreate,
  MemberEnd,
  MemberImport,
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

/** register_member allocates the card number. */
export const create = (ctx: Ctx, input: z.infer<typeof MemberCreate>) =>
  asUser(ctx, async (tx) => {
    const { feeMethod, taxCodeConfirmed, ...f } = input;
    const snake = Object.fromEntries(
      Object.entries(repo.COLS).map(([k, c]) => [c, (f as Record<string, unknown>)[k]]),
    );
    snake.tax_code = taxOf(f.taxCode, taxCodeConfirmed);
    const id = await repo.register(tx, snake, feeMethod ?? null);
    return (await repo.detail(tx, id))!;
  });

const IMPORT_MSG: Record<string, string> = {
  firstName: 'Nome mancante o troppo lungo',
  lastName: 'Cognome mancante o troppo lungo',
  birthDate: 'Data non valida',
  joinedOn: 'Data non valida',
  privacySignedOn: 'Data non valida',
  postalCode: 'Il CAP deve avere 5 cifre',
  email: 'Indirizzo email non valido',
  memberType: 'Tipo di socio non valido',
};
type RowError = { field: string; message: string; code?: string };

/** Bulk import (ADR-048 tax codes): validates every row, blocks duplicates, inserts only clean rows unless dryRun. */
export const importRows = (ctx: Ctx, input: z.infer<typeof MemberImport>) =>
  asUser(ctx, async (tx) => {
    const parsed = input.rows.map((raw) => {
      const errors: RowError[] = [];
      const r = MemberImportRow.safeParse(raw);
      if (!r.success) {
        for (const i of r.error.issues) {
          const field = String(i.path[0] ?? '');
          errors.push({
            field,
            message: IMPORT_MSG[field] ?? (field ? 'Valore non valido' : 'Campo sconosciuto'),
          });
        }
        return { errors, data: undefined };
      }
      const { taxCodeConfirmed, ...f } = r.data;
      try {
        f.taxCode = taxOf(f.taxCode, taxCodeConfirmed);
      } catch (e) {
        if (!(e instanceof DomainError)) throw e;
        errors.push({ field: 'taxCode', message: e.message, code: e.code });
      }
      return { errors, data: f };
    });
    // Duplicates: same tax code, or same name and birth date, inside the file or already registered.
    const keyOf = (f: { firstName: string; lastName: string; birthDate?: string | null }) =>
      f.birthDate ? `${f.lastName}|${f.firstName}|${f.birthDate}`.toLowerCase() : null;
    const codes = parsed.flatMap((p) => (p.data?.taxCode ? [p.data.taxCode] : []));
    const keys = parsed.flatMap((p) => (p.data && keyOf(p.data) ? [keyOf(p.data)!] : []));
    const existing = await repo.findDuplicates(tx, codes, keys);
    const seenCode = new Map<string, number>();
    const seenKey = new Map<string, number>();
    parsed.forEach((p, i) => {
      if (!p.data) return;
      const code = p.data.taxCode;
      const key = keyOf(p.data);
      const hit = existing.find((m) => (code && m.taxCode === code) || (key && m.key === key));
      if (hit)
        p.errors.push({
          field: hit.taxCode === code ? 'taxCode' : 'lastName',
          message: `Socio già registrato: tessera n. ${hit.cardNumber}`,
          code: 'DUPLICATE',
        });
      const prevCode = code ? seenCode.get(code) : undefined;
      const prev = prevCode ?? (key ? seenKey.get(key) : undefined);
      if (prev !== undefined)
        p.errors.push({
          field: prevCode !== undefined ? 'taxCode' : 'lastName',
          message: `Socio ripetuto nel file (riga ${prev + 1})`,
          code: 'DUPLICATE',
        });
      if (code && !seenCode.has(code)) seenCode.set(code, i);
      if (key && !seenKey.has(key)) seenKey.set(key, i);
    });
    const rows = [];
    let created = 0;
    for (const p of parsed) {
      let cardNumber: number | null = null;
      if (!input.dryRun && p.errors.length === 0) {
        const snake = Object.fromEntries(
          Object.entries(repo.COLS).map(([k, c]) => [c, (p.data as Record<string, unknown>)[k]]),
        );
        cardNumber = (await repo.byId(tx, await repo.register(tx, snake, null)))!.cardNumber;
        created++;
      }
      rows.push({ errors: p.errors, cardNumber });
    }
    return { created, rows };
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
