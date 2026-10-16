import { z } from '@hono/zod-openapi';
import { hhmm } from '../../lib/http.js';

const status = z.enum(['richiesto', 'assegnato', 'confermato', 'svolto', 'annullato']);

export const Transport = z
  .strictObject({
    id: z.uuid(),
    clientId: z.uuid(),
    clientName: z.string(),
    clientPhone: z.string(),
    travelDate: z.string(),
    departureTime: z.string().nullable(),
    appointmentTime: z.string().nullable(),
    returnTime: z.string().nullable(),
    fromAddress: z.string().nullable(),
    toAddress: z.string().nullable(),
    requestedBy: z.string().nullable(),
    reason: z.string().nullable(),
    wheelchair: z.boolean(),
    companion: z.boolean(),
    notes: z.string().nullable(),
    status,
    driverId: z.uuid().nullable(),
    driverName: z.string().nullable(),
    vehicleId: z.uuid().nullable(),
    vehiclePlate: z.string().nullable(),
    km: z.number().nullable(),
    driverNotes: z.string().nullable(),
    bookingId: z.uuid().nullable(),
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
  requestedBy: text(100),
  reason: text(200),
  wheelchair: z.boolean().optional(),
  companion: z.boolean().optional(),
  notes: text(500),
};
const returnAfterDeparture = (t: { departureTime?: string | null; returnTime?: string | null }) =>
  !t.departureTime || !t.returnTime || t.returnTime > t.departureTime;
const returnMsg = { message: 'Il ritorno deve seguire la partenza' };

export const TransportCreate = z
  .strictObject({ clientId: z.uuid(), ...fields })
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
export const TransportComplete = z
  .strictObject({
    km: z.number().min(0).max(9999.9),
    driverNotes: z.string().trim().max(500).nullable().optional(),
  })
  .openapi('TransportComplete');

export const CsvQuery = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
