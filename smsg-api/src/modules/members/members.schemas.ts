import { z } from '@hono/zod-openapi';
import { PageQuery, pageOf } from '../../lib/pagination.js';
import { Transport } from '../transports/transports.schemas.js';
import { Invoice, PaymentMethod } from '../invoices/invoices.schemas.js';

const memberType = z.enum(['ordinario', 'familiare', 'sostenitore', 'onorario']);
const endReason = z.enum([
  'dimissioni',
  'decesso',
  'mancato_pagamento',
  'esclusione',
  'trasferimento',
]);

export const Member = z
  .strictObject({
    id: z.uuid(),
    cardNumber: z.number().int(),
    firstName: z.string(),
    lastName: z.string(),
    taxCode: z.string().nullable(),
    birthDate: z.string().nullable(),
    birthPlace: z.string().nullable(),
    address: z.string().nullable(),
    postalCode: z.string().nullable(),
    city: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    memberType,
    joinedOn: z.string(),
    status: z.enum(['attivo', 'cessato']),
    endedOn: z.string().nullable(),
    endReason: endReason.nullable(),
    privacySignedOn: z.string().nullable(),
    notes: z.string().nullable(),
    anonymizedAt: z.string().nullable(),
    feePaidCurrentYear: z.boolean(),
  })
  .openapi('Member');
export type Member = z.infer<typeof Member>;
export const MemberPage = pageOf(Member).openapi('MemberPage');

export const Fee = z
  .strictObject({
    id: z.uuid(),
    memberId: z.uuid(),
    year: z.number().int(),
    amountCents: z.number().int(),
    paidOn: z.string(),
    method: PaymentMethod,
  })
  .openapi('MembershipFee');
export type Fee = z.infer<typeof Fee>;

export const MemberDetail = Member.extend({
  fees: z.array(Fee),
  transports: z.array(Transport),
  invoices: z.array(Invoice),
}).openapi('MemberDetail');

export const MembersQuery = PageQuery.extend({
  filter: z.enum(['attivi', 'da_rinnovare', 'cessati', 'tutti']).default('attivi'),
  q: z.string().trim().max(100).optional(),
});
export type MembersQuery = z.infer<typeof MembersQuery>;

export const MemberKpis = z
  .strictObject({
    active: z.number().int(),
    paidCurrentYear: z.number().int(),
    unpaidCurrentYear: z.number().int(),
    joinedCurrentYear: z.number().int(),
    ceased: z.number().int(),
    total: z.number().int(),
  })
  .openapi('MemberKpis');

const str = (max: number) => z.string().trim().max(max).nullable().optional();
const fields = {
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  taxCode: str(40),
  taxCodeConfirmed: z.boolean().optional(),
  birthDate: z.iso.date().nullable().optional(),
  birthPlace: str(80),
  address: str(200),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, 'CAP di 5 cifre')
    .nullable()
    .optional(),
  city: str(80),
  phone: str(30),
  email: z.email().max(120).nullable().optional(),
  memberType: memberType.optional(),
  joinedOn: z.iso.date().optional(),
  privacySignedOn: z.iso.date().nullable().optional(),
  notes: str(600),
};
export const MemberCreate = z
  .strictObject({
    ...fields,
    feeMethod: PaymentMethod.optional(),
  })
  .openapi('MemberCreate');
export const MemberPatch = z.strictObject(fields).partial().openapi('MemberPatch');

export const MemberEnd = z
  .strictObject({ endedOn: z.iso.date().optional(), endReason })
  .openapi('MemberEnd');

export const FeeCreate = z
  .strictObject({
    method: PaymentMethod,
    year: z.number().int().min(2000).max(2100).optional(),
    amountCents: z.number().int().min(0).max(10_000_000).optional(),
    paidOn: z.iso.date().optional(),
  })
  .openapi('FeeCreate');

export const FeeParams = z.object({ id: z.uuid(), feeId: z.uuid() });
