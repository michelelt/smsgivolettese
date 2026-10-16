import { z } from '@hono/zod-openapi';
import { hhmm } from '../../lib/http.js';

export const ShiftType = z
  .strictObject({
    id: z.uuid(),
    name: z.string(),
    active: z.boolean(),
    sortOrder: z.number().int(),
  })
  .openapi('ShiftType');
export type ShiftType = z.infer<typeof ShiftType>;
export const ShiftTypesResponse = z.object({ items: z.array(ShiftType) }).openapi('ShiftTypes');
const typeBase = {
  name: z.string().trim().min(1).max(80),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
};
export const ShiftTypeCreate = z.strictObject(typeBase).openapi('ShiftTypeCreate');
export const ShiftTypePatch = z.strictObject(typeBase).partial().openapi('ShiftTypePatch');

export const ShiftAssignment = z
  .strictObject({
    id: z.uuid(),
    volunteerId: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    status: z.enum(['proposto', 'confermato', 'rifiutato']),
  })
  .openapi('ShiftAssignment');
export type ShiftAssignment = z.infer<typeof ShiftAssignment>;

export const Shift = z
  .strictObject({
    id: z.uuid(),
    shiftTypeId: z.uuid(),
    shiftType: z.string(),
    day: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    requiredSlots: z.number().int(),
    notes: z.string().nullable(),
    filled: z.number().int(),
    coverage: z.enum(['scoperto', 'parziale', 'coperto']),
    assignments: z.array(ShiftAssignment),
  })
  .openapi('Shift');
export type Shift = z.infer<typeof Shift>;
export const ShiftsResponse = z.object({ items: z.array(Shift) }).openapi('Shifts');

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
export const ShiftsQuery = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((q) => days(q.from, q.to) >= 0 && days(q.from, q.to) < 42, {
    message: 'Intervallo massimo 42 giorni',
  });
export type ShiftsQuery = z.infer<typeof ShiftsQuery>;

const shiftBase = {
  shiftTypeId: z.uuid(),
  day: z.iso.date(),
  startTime: hhmm,
  endTime: hhmm,
  requiredSlots: z.number().int().min(1).max(50),
  notes: z.string().trim().max(500).nullable().optional(),
};
export const ShiftCreate = z
  .strictObject(shiftBase)
  .refine((s) => s.endTime > s.startTime, { message: "L'ora di fine deve seguire l'inizio" })
  .openapi('ShiftCreate');
export const ShiftPatch = z.strictObject(shiftBase).partial().openapi('ShiftPatch');

const monday = z.iso.date().refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, {
  message: 'Deve essere un lunedì',
});
export const CopyWeek = z
  .strictObject({ fromWeek: monday, toWeek: monday })
  .refine((b) => b.fromWeek !== b.toWeek, { message: 'Le settimane devono essere diverse' })
  .openapi('CopyWeek');
export const CopyWeekResult = z
  .strictObject({ created: z.number().int(), skipped: z.number().int() })
  .openapi('CopyWeekResult');

export const AssignBody = z.strictObject({ volunteerId: z.uuid() }).openapi('ShiftAssign');
export const AssignmentParams = z.object({ id: z.uuid(), assignmentId: z.uuid() });

export const CandidateSchema = z
  .strictObject({
    volunteerId: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    status: z.enum(['disponibile', 'non_indicata', 'non_disponibile', 'gia_impegnato', 'assente']),
    selectable: z.boolean(),
    commitmentsInMonth: z.number().int(),
  })
  .openapi('Candidate');
export const CandidatesResponse = z
  .object({ items: z.array(CandidateSchema) })
  .openapi('Candidates');
