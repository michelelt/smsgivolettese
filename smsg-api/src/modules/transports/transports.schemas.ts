import { z } from '@hono/zod-openapi';
import { hhmm } from '../../lib/http.js';

const status = z.enum(['richiesto', 'assegnato', 'confermato', 'svolto', 'annullato']);

export const Transport = z
  .strictObject({
    id: z.uuid(),
    memberId: z.uuid(),
    memberName: z.string(),
    contactPhone: z.string().nullable(),
    travelDate: z.string(),
    departureTime: z.string().nullable(),
    appointmentTime: z.string().nullable(),
    returnTime: z.string().nullable(),
    fromAddress: z.string().nullable(),
    toAddress: z.string().nullable(),
    wheelchair: z.boolean(),
    mobilityAids: z.boolean(),
    companions: z.number().int(),
    notes: z.string().nullable(),
    status,
    driverId: z.uuid().nullable(),
    driverName: z.string().nullable(),
    vehicleId: z.uuid().nullable(),
    vehiclePlate: z.string().nullable(),
    odometerStart: z.number().int().nullable(),
    odometerEnd: z.number().int().nullable(),
    km: z.number().int().nullable(),
    driverNotes: z.string().nullable(),
    invoiceId: z.uuid().nullable(),
  })
  .openapi('Transport');
export type Transport = z.infer<typeof Transport>;
export const TransportsResponse = z
  .object({ items: z.array(Transport), total: z.number().int() })
  .openapi('Transports');

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
export const TransportsQuery = z
  .object({ from: z.iso.date(), to: z.iso.date(), status: status.optional() })
  .refine((q) => days(q.from, q.to) >= 0 && days(q.from, q.to) < 42, {
    message: 'Intervallo massimo 42 giorni',
  });
export type TransportsQuery = z.infer<typeof TransportsQuery>;

const text = (n: number) => z.string().trim().min(1).max(n).nullable().optional();
const fields = {
  travelDate: z.iso.date(),
  departureTime: hhmm.nullable().optional(),
  appointmentTime: hhmm.nullable().optional(),
  returnTime: hhmm.nullable().optional(),
  fromAddress: text(200),
  toAddress: text(200),
  contactPhone: text(40),
  wheelchair: z.boolean().optional(),
  mobilityAids: z.boolean().optional(),
  companions: z.number().int().min(0).max(8).optional(),
  notes: text(500),
};
const returnAfterDeparture = (t: { departureTime?: string | null; returnTime?: string | null }) =>
  !t.departureTime || !t.returnTime || t.returnTime > t.departureTime;
const returnMsg = { message: 'Il ritorno deve seguire la partenza' };

export const TransportCreate = z
  .strictObject({ memberId: z.uuid(), ...fields })
  .refine((t) => !!t.departureTime || !!t.appointmentTime, {
    message: "Indica l'ora di partenza da casa o l'ora dell'appuntamento",
  })
  .refine(returnAfterDeparture, returnMsg)
  .openapi('TransportCreate');
export const TransportPatch = z
  .strictObject(fields)
  .partial()
  .refine(returnAfterDeparture, returnMsg)
  .openapi('TransportPatch');

export const TransportAssign = z
  .strictObject({ driverId: z.uuid(), vehicleId: z.uuid().nullable().optional() })
  .openapi('TransportAssign');
const odo = z.number().int().min(0).max(9_999_999);
export const odometerFields = {
  odometerStart: odo,
  odometerEnd: odo,
  driverNotes: z.string().trim().max(500).nullable().optional(),
};
export const odometerOk = (o: { odometerStart: number; odometerEnd: number }) =>
  o.odometerEnd >= o.odometerStart && o.odometerEnd - o.odometerStart <= 2000;
export const odometerMsg = {
  message:
    "Controlli i chilometri: l'arrivo deve essere uguale o maggiore della partenza (al massimo 2000 km)",
};
export const TransportComplete = z
  .strictObject(odometerFields)
  .refine(odometerOk, odometerMsg)
  .openapi('TransportComplete');

export const CsvQuery = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
