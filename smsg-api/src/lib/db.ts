import postgres from 'postgres';
import { env } from '../config/env.js';

// ADR-002: every query runs in a transaction under the caller's Postgres role and JWT claims.
// prepare:false for the transaction pooler.
let pool: postgres.Sql | undefined;
const conn = () => {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return (pool ??= postgres(env.DATABASE_URL, { prepare: false, max: 5, onnotice: () => {} }));
};

export type Tx = postgres.TransactionSql;
export type Claims = { sub: string; app_role?: string };

async function run<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  claims: Record<string, unknown>,
  requestId: string | undefined,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return conn().begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
                    set_config('app.request_id', ${requestId ?? ''}, true)`;
    await tx.unsafe(`set local role ${role}`); // role is a closed literal union, never user input
    return fn(tx);
  }) as Promise<T>;
}

export const db = {
  asUser: <T>(claims: Claims, fn: (tx: Tx) => Promise<T>, requestId?: string) =>
    run('authenticated', { role: 'authenticated', ...claims }, requestId, fn),
  asAnon: <T>(fn: (tx: Tx) => Promise<T>, requestId?: string) =>
    run('anon', { role: 'anon' }, requestId, fn),
  // No app_role claim: app.has_role() is false. Only cron, invites, bootstrap, rate limiting.
  asService: <T>(fn: (tx: Tx) => Promise<T>, requestId?: string) =>
    run('service_role', { role: 'service_role' }, requestId, fn),
  end: () => pool?.end(),
};
