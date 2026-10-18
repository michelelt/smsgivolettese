import { z } from '@hono/zod-openapi';
import { hhmm } from '../../lib/http.js';
import { PageQuery, pageOf } from '../../lib/pagination.js';

export const AvailabilityRule = z
  .strictObject({
    weekday: z.number().int().min(1).max(7),
    startTime: hhmm,
    endTime: hhmm,
  })
  .refine((r) => r.endTime > r.startTime, { message: "L'ora di fine deve seguire l'inizio" })
  .openapi('AvailabilityRule');
export type AvailabilityRule = z.infer<typeof AvailabilityRule>;

export const Absence = z
  .strictObject({
    id: z.uuid(),
    startsOn: z.string(),
    endsOn: z.string(),
    note: z.string().nullable(),
  })
  .openapi('Absence');
export type Absence = z.infer<typeof Absence>;

export const Volunteer = z
  .strictObject({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    canDrive: z.boolean(),
    licenseNumber: z.string().nullable(),
    licenseExpiresOn: z.string().nullable(),
    notes: z.string().nullable(),
    active: z.boolean(),
  })
  .openapi('Volunteer');
export type Volunteer = z.infer<typeof Volunteer>;
export const VolunteerPage = pageOf(Volunteer).openapi('VolunteerPage');

export const VolunteerDetail = Volunteer.extend({
  rules: z.array(AvailabilityRule),
  absences: z.array(Absence),
}).openapi('VolunteerDetail');

export const VolunteersQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type VolunteersQuery = z.infer<typeof VolunteersQuery>;

export const VolunteerPatch = z
  .strictObject({
    phone: z.string().trim().max(30).nullable(),
    canDrive: z.boolean(),
    licenseNumber: z.string().trim().max(40).nullable(),
    licenseExpiresOn: z.iso.date().nullable(),
    notes: z.string().trim().max(1000).nullable(),
    active: z.boolean(),
  })
  .partial()
  .openapi('VolunteerPatch');

export const AvailabilityOverview = z
  .object({
    items: z.array(
      z.strictObject({
        volunteerId: z.uuid(),
        firstName: z.string(),
        lastName: z.string(),
        canDrive: z.boolean(),
        rules: z.array(AvailabilityRule),
        absences: z.array(Absence.omit({ note: true })),
      }),
    ),
  })
  .openapi('AvailabilityOverview');
