import { z } from '@hono/zod-openapi';

export const Me = z
  .object({ id: z.uuid(), role: z.enum(['volontario', 'staff', 'super_admin']) })
  .openapi('Me');
