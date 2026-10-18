import { z } from '@hono/zod-openapi';

export const Subject = z.enum(['member', 'user']);
export const ExportQuery = z.object({ subject: Subject, id: z.uuid() });
export const AnonymizeBody = z
  .strictObject({ subject: Subject, id: z.uuid() })
  .openapi('GdprAnonymize');
export type AnonymizeBody = z.infer<typeof AnonymizeBody>;
export const Anonymized = z
  .strictObject({
    retainedInvoices: z.array(
      z.strictObject({ id: z.uuid(), year: z.number().int(), number: z.number().int() }),
    ),
  })
  .openapi('GdprAnonymized');
