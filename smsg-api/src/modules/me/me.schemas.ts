import { z } from '@hono/zod-openapi';
import { odometerFields, odometerMsg, odometerOk } from '../transports/transports.schemas.js';
import { Absence, AvailabilityRule } from '../volunteers/volunteers.schemas.js';

export const Me = z
  .object({
    id: z.uuid(),
    role: z.enum(['volontario', 'staff', 'super_admin']),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  })
  .openapi('Me');

export const MyAvailability = z
  .strictObject({ rules: z.array(AvailabilityRule) })
  .openapi('MyAvailability');
export const MyAvailabilityPut = z
  .strictObject({ rules: z.array(AvailabilityRule).max(30) })
  .openapi('MyAvailabilityPut');

export const MyAbsences = z.strictObject({ items: z.array(Absence) }).openapi('MyAbsences');
export const AbsenceCreate = z
  .strictObject({
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .refine((a) => a.endsOn >= a.startsOn, { message: 'La fine deve essere uguale o successiva' })
  .openapi('AbsenceCreate');
export const AbsenceCreated = z
  .strictObject({ id: z.uuid(), conflictingCommitments: z.number().int() })
  .openapi('AbsenceCreated');

export const MyShift = z
  .strictObject({
    assignmentId: z.uuid(),
    shiftType: z.string(),
    day: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    status: z.enum(['proposto', 'confermato', 'rifiutato']),
    notes: z.string().nullable(),
  })
  .openapi('MyShift');
export type MyShift = z.infer<typeof MyShift>;

/** Strict: only what `volunteer_transports_v` exposes (no reason, no staff notes, no billing). */
export const MyTransport = z
  .strictObject({
    id: z.uuid(),
    travelDate: z.string(),
    departureTime: z.string().nullable(),
    appointmentTime: z.string().nullable(),
    returnTime: z.string().nullable(),
    fromAddress: z.string().nullable(),
    toAddress: z.string().nullable(),
    wheelchair: z.boolean(),
    mobilityAids: z.boolean(),
    companions: z.number().int(),
    status: z.enum(['assegnato', 'confermato', 'svolto']),
    odometerStart: z.number().int().nullable(),
    odometerEnd: z.number().int().nullable(),
    km: z.number().int().nullable(),
    driverNotes: z.string().nullable(),
    memberFirstName: z.string(),
    memberLastName: z.string(),
    contactPhone: z.string().nullable(),
    vehiclePlate: z.string().nullable(),
    vehicleModel: z.string().nullable(),
  })
  .openapi('MyTransport');
export type MyTransport = z.infer<typeof MyTransport>;

export const MyCommitments = z
  .strictObject({ shifts: z.array(MyShift), transports: z.array(MyTransport) })
  .openapi('MyCommitments');

export const Respond = z.strictObject({ accept: z.boolean() }).openapi('Respond');
export const MyTransportComplete = z
  .strictObject(odometerFields)
  .refine(odometerOk, odometerMsg)
  .openapi('MyTransportComplete');
