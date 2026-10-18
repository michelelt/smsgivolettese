import { z } from '@hono/zod-openapi';
import { PageQuery, pageOf } from '../../lib/pagination.js';

const Role = z.enum(['volontario', 'staff', 'super_admin']);

// staff/super_admin invites additionally need users.invite_staff (checked in the service).
export const InviteBody = z
  .strictObject({
    email: z.email().max(200),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    role: Role,
  })
  .openapi('UserInvite');
export const Invited = z.strictObject({ id: z.uuid() }).openapi('UserInvited');

export const UsersQuery = PageQuery.extend({
  role: Role.optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  q: z.string().trim().max(100).optional(),
});
export type UsersQuery = z.infer<typeof UsersQuery>;

export const UserItem = z
  .strictObject({
    id: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    role: Role,
    active: z.boolean(),
    anonymizedAt: z.string().nullable(),
  })
  .openapi('UserItem');
export type UserItem = z.infer<typeof UserItem>;
export const UserPage = pageOf(UserItem).openapi('UserPage');

export const RoleBody = z.strictObject({ role: Role }).openapi('UserRoleChange');
export const MfaReset = z.strictObject({ removed: z.number().int() }).openapi('UserMfaReset');
