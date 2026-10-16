import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { requirePermission, type AuthEnv } from '../../auth/middleware.js';
import { attachment, ctxOf, defaultHook, errs, fileContent, IdParam } from '../../lib/http.js';
import * as service from './invoices.service.js';
import {
  InvoiceDetail,
  InvoiceIssue,
  InvoiceKpis,
  InvoicePage,
  InvoicePay,
  InvoicesQuery,
  InvoiceVoid,
  YearQuery,
} from './invoices.schemas.js';

const sec = [{ bearerAuth: [] }];
const ok = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  content: { 'application/json': { schema } },
  required: true as const,
});
const base = { tags: ['invoices'], security: sec };

const list = createRoute({
  ...base,
  method: 'get',
  path: '/invoices',
  middleware: [requirePermission('invoices.read')] as const,
  request: { query: InvoicesQuery },
  responses: { 200: ok(InvoicePage, 'Fatture'), ...errs() },
});
const kpis = createRoute({
  ...base,
  method: 'get',
  path: '/invoices/kpis',
  middleware: [requirePermission('invoices.read')] as const,
  request: { query: YearQuery },
  responses: { 200: ok(InvoiceKpis, 'Indicatori (fatture non annullate)'), ...errs() },
});
const csv = createRoute({
  ...base,
  method: 'get',
  path: '/invoices/export.csv',
  middleware: [requirePermission('invoices.export')] as const,
  request: { query: YearQuery },
  responses: { 200: fileContent('text/csv'), ...errs() },
});
const get = createRoute({
  ...base,
  method: 'get',
  path: '/invoices/{id}',
  middleware: [requirePermission('invoices.read')] as const,
  request: { params: IdParam },
  responses: { 200: ok(InvoiceDetail, 'Fattura con righe'), ...errs(404) },
});
const pdf = createRoute({
  ...base,
  method: 'get',
  path: '/invoices/{id}/pdf',
  middleware: [requirePermission('invoices.read')] as const,
  request: { params: IdParam },
  responses: { 200: fileContent('application/pdf'), ...errs(404) },
});
const issue = createRoute({
  ...base,
  method: 'post',
  path: '/invoices',
  middleware: [requirePermission('invoices.issue')] as const,
  request: { body: body(InvoiceIssue) },
  responses: { 201: ok(InvoiceDetail, 'Fattura emessa'), ...errs(404, 409, 422) },
});
const pay = createRoute({
  ...base,
  method: 'post',
  path: '/invoices/{id}/pay',
  middleware: [requirePermission('invoices.mark_paid')] as const,
  request: { params: IdParam, body: body(InvoicePay) },
  responses: { 200: ok(InvoiceDetail, 'Fattura pagata'), ...errs(404, 409) },
});
const voidRoute = createRoute({
  ...base,
  method: 'post',
  path: '/invoices/{id}/void',
  middleware: [requirePermission('invoices.void')] as const,
  request: { params: IdParam, body: body(InvoiceVoid) },
  responses: { 200: ok(InvoiceDetail, 'Fattura annullata'), ...errs(404, 409) },
});

export const invoicesRoutes = new OpenAPIHono<AuthEnv>({ defaultHook })
  .openapi(list, async (c) => c.json(await service.list(ctxOf(c), c.req.valid('query')), 200))
  .openapi(kpis, async (c) => c.json(await service.kpis(ctxOf(c), c.req.valid('query').year), 200))
  .openapi(csv, async (c) => {
    const f = await service.csv(ctxOf(c), c.req.valid('query').year);
    return attachment(f.body, 'text/csv; charset=utf-8', f.filename) as never;
  })
  .openapi(get, async (c) => c.json(await service.get(ctxOf(c), c.req.valid('param').id), 200))
  .openapi(pdf, async (c) => {
    const f = await service.pdf(ctxOf(c), c.req.valid('param').id);
    return attachment(f.body, 'application/pdf', f.filename) as never;
  })
  .openapi(issue, async (c) => c.json(await service.issue(ctxOf(c), c.req.valid('json')), 201))
  .openapi(pay, async (c) => {
    const { method, paidOn } = c.req.valid('json');
    return c.json(await service.pay(ctxOf(c), c.req.valid('param').id, method, paidOn), 200);
  })
  .openapi(voidRoute, async (c) =>
    c.json(
      await service.voidInvoice(ctxOf(c), c.req.valid('param').id, c.req.valid('json').reason),
      200,
    ),
  );
