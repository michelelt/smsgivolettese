import { z } from '@hono/zod-openapi';

// Phase 5: volunteers only; staff invites arrive with the user admin screens (phase 7, ADR-053).
export const InviteBody = z
  .strictObject({
    email: z.email().max(200),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    role: z.literal('volontario'),
  })
  .openapi('UserInvite');
export const Invited = z.strictObject({ id: z.uuid() }).openapi('UserInvited');
