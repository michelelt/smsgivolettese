import type { z } from '@hono/zod-openapi';
import { asUser, type Ctx } from '../../lib/ctx.js';
import { csvDate, toCsv } from '../../lib/csv.js';
import type { Tx } from '../../lib/db.js';
import {
  Conflict,
  DomainError,
  NotFound,
  Unprocessable,
  ValidationError,
} from '../../lib/errors.js';
import { transportSheetPdf } from '../../lib/pdf.js';
import { candidates } from '../shifts/candidates.js';
import { dispatch, transportItem, volunteerMail, type Mail } from '../notifications/notify.js';
import * as repo from './transports.repo.js';
import type { TransportCreate, TransportPatch, TransportsQuery } from './transports.schemas.js';

const nothing = (o: object) => Object.values(o).every((v) => v === undefined);
const missing = () => new NotFound('Trasporto non trovato');
const invalid = () =>
  new Conflict(
    'Operazione non consentita nello stato attuale del trasporto',
    'TRANSPORT_INVALID_TRANSITION',
  );

export const list = (ctx: Ctx, q: TransportsQuery) =>
  asUser(ctx, async (tx) => {
    const items = await repo.list(tx, q);
    return { items, total: items.length };
  });

export const get = async (ctx: Ctx, id: string) => {
  const t = await asUser(ctx, (tx) => repo.byId(tx, id));
  if (!t) throw missing();
  return t;
};

export const create = (ctx: Ctx, input: z.infer<typeof TransportCreate>) =>
  asUser(ctx, async (tx) => {
    const { memberId, ...f } = input;
    if (!(await repo.memberExists(tx, memberId)))
      throw new DomainError(404, 'MEMBER_NOT_FOUND', 'Socio non trovato');
    return (await repo.byId(tx, await repo.insert(tx, memberId, f, ctx.user.id)))!;
  });

type Row = NonNullable<Awaited<ReturnType<typeof repo.byId>>>;
const moved = (a: Row, b: Row) =>
  (
    [
      'travelDate',
      'departureTime',
      'appointmentTime',
      'returnTime',
      'fromAddress',
      'toAddress',
    ] as const
  ).some((k) => a[k] !== b[k]);

export async function update(ctx: Ctx, id: string, input: z.infer<typeof TransportPatch>) {
  if (nothing(input)) throw new ValidationError('Nessuna modifica');
  const mails: Mail[] = [];
  const t = await asUser(ctx, async (tx) => {
    const before = await repo.byId(tx, id);
    if (!before) throw missing();
    if (!(await repo.patch(tx, id, input))) throw invalid();
    let after = (await repo.byId(tx, id))!;
    if (
      before.driverId &&
      ['assegnato', 'confermato'].includes(before.status) &&
      moved(before, after)
    ) {
      await repo.rearm(tx, id);
      after = (await repo.byId(tx, id))!;
      const item = await transportItem(tx, id);
      if (item) mails.push(...(await volunteerMail(tx, before.driverId, 'modified', item)));
    }
    return after;
  });
  await dispatch(mails);
  return t;
}

/** Runs a conditional UPDATE; zero rows = 404 or TRANSPORT_INVALID_TRANSITION. */
async function transition(
  tx: Tx,
  id: string,
  run: () => Promise<unknown[]>,
  err: () => Error = invalid,
) {
  if ((await run()).length === 0) {
    if (!(await repo.byId(tx, id))) throw missing();
    throw err();
  }
}

export async function assign(ctx: Ctx, id: string, driverId: string, vehicleId: string | null) {
  const mails: Mail[] = [];
  const t = await asUser(ctx, async (tx) => {
    const before = await repo.byId(tx, id);
    if (!before) throw missing();
    if (!['richiesto', 'assegnato', 'confermato'].includes(before.status)) throw invalid();
    if (!before.departureTime || !before.fromAddress || !before.toAddress)
      throw new Unprocessable(
        'Servono orario di partenza e indirizzi di partenza e arrivo',
        'TRANSPORT_INCOMPLETE',
      );
    await transition(tx, id, () => repo.assign(tx, id, driverId, vehicleId));
    if (before.driverId !== driverId) {
      const item = (await transportItem(tx, id))!;
      if (before.driverId)
        mails.push(...(await volunteerMail(tx, before.driverId, 'cancelled', item)));
      mails.push(...(await volunteerMail(tx, driverId, 'assigned', item)));
    }
    return (await repo.byId(tx, id))!;
  });
  await dispatch(mails);
  return t;
}

/** unassign and cancel: the (previous) driver is told the commitment is gone. */
async function release(ctx: Ctx, id: string, run: (tx: Tx) => Promise<unknown[]>) {
  const mails: Mail[] = [];
  const t = await asUser(ctx, async (tx) => {
    const before = await repo.byId(tx, id);
    if (!before) throw missing();
    await transition(tx, id, () => run(tx));
    if (before.driverId && ['assegnato', 'confermato'].includes(before.status)) {
      const item = await transportItem(tx, id);
      if (item) mails.push(...(await volunteerMail(tx, before.driverId, 'cancelled', item)));
    }
    return (await repo.byId(tx, id))!;
  });
  await dispatch(mails);
  return t;
}
export const unassign = (ctx: Ctx, id: string) => release(ctx, id, (tx) => repo.unassign(tx, id));
export const cancel = (ctx: Ctx, id: string) => release(ctx, id, (tx) => repo.cancel(tx, id));

export const complete = (
  ctx: Ctx,
  id: string,
  o: { odometerStart: number; odometerEnd: number; driverNotes?: string | null },
) =>
  asUser(ctx, async (tx) => {
    await transition(
      tx,
      id,
      () => repo.complete(tx, id, o.odometerStart, o.odometerEnd, o.driverNotes ?? null),
      () => new Conflict('Il trasporto non può essere completato', 'TRANSPORT_NOT_COMPLETABLE'),
    );
    return (await repo.byId(tx, id))!;
  });

export const transportCandidates = (ctx: Ctx, id: string) =>
  asUser(ctx, async (tx) => {
    const p = await repo.busyPeriod(tx, id);
    if (!p) throw missing();
    if (!p.start || !p.end)
      throw new Unprocessable("Manca l'orario di partenza", 'TRANSPORT_INCOMPLETE');
    return {
      items: await candidates(tx, {
        start: p.start,
        end: p.end,
        driverDate: p.travelDate,
        ownTransportId: id,
      }),
    };
  });

export async function sheet(ctx: Ctx, id: string) {
  const t = await get(ctx, id);
  return {
    filename: `foglio-viaggio-${t.travelDate}.pdf`,
    body: await transportSheetPdf({
      ...t,
      vehicle: t.vehiclePlate,
    }),
  };
}

type CsvRow = Awaited<ReturnType<typeof repo.csvRows>>[number];
export const TRANSPORT_CSV_HEADER = [
  'Data',
  'Partenza',
  'Socio',
  'Da',
  'A',
  'Autista',
  'Targa',
  'Km partenza',
  'Km arrivo',
  'Km',
  'Carrozzina',
  'Ausili',
  'Accompagnatori',
  'Note autista',
];
export const transportsCsv = (rows: CsvRow[]) =>
  toCsv(
    TRANSPORT_CSV_HEADER,
    rows.map((r) => [
      csvDate(r.travelDate),
      r.departureTime,
      r.memberName,
      r.fromAddress,
      r.toAddress,
      r.driverName,
      r.vehiclePlate,
      r.odometerStart,
      r.odometerEnd,
      r.km,
      r.wheelchair ? 'Sì' : 'No',
      r.mobilityAids ? 'Sì' : 'No',
      r.companions,
      r.driverNotes,
    ]),
  );

export async function csv(ctx: Ctx, month: string) {
  const rows = await asUser(ctx, (tx) => repo.csvRows(tx, month));
  return { filename: `trasporti-${month}.csv`, body: transportsCsv(rows) };
}
