import { db, type Tx } from './db.js';
import type { AuthUser } from '../auth/middleware.js';

/** Who is calling; built by routes, passed through services to repos. */
export type Ctx = { user: AuthUser; requestId?: string };

export const asUser = <T>(ctx: Ctx, fn: (tx: Tx) => Promise<T>) =>
  db.asUser({ sub: ctx.user.id, app_role: ctx.user.role ?? undefined }, fn, ctx.requestId);
