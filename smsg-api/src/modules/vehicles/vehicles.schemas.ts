import { z } from '@hono/zod-openapi';

export const Vehicle = z
  .strictObject({
    id: z.uuid(),
    plate: z.string(),
    model: z.string(),
    seats: z.number().int(),
    wheelchairAccessible: z.boolean(),
    active: z.boolean(),
  })
  .openapi('Vehicle');
export type Vehicle = z.infer<typeof Vehicle>;
export const VehiclesResponse = z.object({ items: z.array(Vehicle) }).openapi('Vehicles');

const base = {
  plate: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .transform((s) => s.replaceAll(/\s/g, '').toUpperCase()),
  model: z.string().trim().min(1).max(80),
  seats: z.number().int().min(1).max(9),
  wheelchairAccessible: z.boolean().optional(),
  active: z.boolean().optional(),
};
export const VehicleCreate = z.strictObject(base).openapi('VehicleCreate');
export const VehiclePatch = z.strictObject(base).partial().openapi('VehiclePatch');
