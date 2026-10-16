import { z } from '@hono/zod-openapi';

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type Page = z.infer<typeof PageQuery>;

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int() });

export const offsetOf = (p: Page) => (p.page - 1) * p.pageSize;

/** `q` = case-insensitive contains; escapes LIKE wildcards. */
export const containsPattern = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;
