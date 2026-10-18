import { z } from '@hono/zod-openapi';

export const StaffService = z
  .strictObject({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    scheduleNote: z.string().nullable(),
    active: z.boolean(),
    sortOrder: z.number().int(),
  })
  .openapi('StaffService');
export type StaffService = z.infer<typeof StaffService>;

const base = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  scheduleNote: z.string().trim().max(200).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
};
export const ServiceCreate = z.strictObject(base).openapi('ServiceCreate');
export const ServicePatch = z.strictObject(base).partial().openapi('ServicePatch');
export const ServicesResponse = z.object({ items: z.array(StaffService) }).openapi('StaffServices');
