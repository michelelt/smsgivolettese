import { z } from '@hono/zod-openapi';

export const HealthResponse = z.object({ status: z.literal('ok') }).openapi('HealthResponse');
