import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { AuthEnv } from '../../auth/middleware.js';
import { Unauthorized } from '../../lib/errors.js';
import { ErrorBody, ok } from '../../lib/http.js';
import * as service from './cron.service.js';

const daily = createRoute({
  tags: ['cron'],
  security: [{ bearerAuth: [] }],
  method: 'get',
  path: '/cron/daily',
  responses: {
    200: ok(
      z
        .strictObject({
          sent: z.number().int(),
          failed: z.number().int(),
          orphansRemoved: z.number().int(),
          proposalsAnonymised: z.number().int(),
        })
        .openapi('CronResult'),
      'Promemoria inviati',
    ),
    401: {
      content: { 'application/json': { schema: ErrorBody } },
      description: 'Segreto non valido',
    },
  },
});

// Not a user route: authorised by CRON_SECRET instead of requirePermission.
export const cronRoutes = new OpenAPIHono<AuthEnv>().openapi(daily, async (c) => {
  if (!service.validSecret(c.req.header('authorization'))) throw new Unauthorized();
  return c.json(await service.daily(c.get('requestId' as never) as string | undefined), 200);
});
