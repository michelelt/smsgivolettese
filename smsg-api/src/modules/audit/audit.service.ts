import { asUser, type Ctx } from '../../lib/ctx.js';
import * as repo from './audit.repo.js';
import type { AuditQuery } from './audit.schemas.js';

export const list = (ctx: Ctx, q: AuditQuery) => asUser(ctx, (tx) => repo.list(tx, q));
