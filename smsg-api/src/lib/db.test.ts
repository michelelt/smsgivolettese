import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgres://x@127.0.0.1:1/x';
  return [] as unknown[][];
});
vi.mock('postgres', () => {
  const tx = Object.assign(
    (...a: unknown[]) => {
      calls.push(a);
      return Promise.resolve([]);
    },
    { unsafe: () => Promise.resolve([]) },
  );
  return { default: () => ({ begin: (fn: (t: unknown) => unknown) => fn(tx) }) };
});

describe('db.asUser', () => {
  it('does not let claims override the authenticated role', async () => {
    const { db } = await import('./db.js');
    await db.asUser({ sub: 'u', role: 'service_role' } as never, async () => 1);
    const claims = JSON.parse(calls[0]![1] as string);
    expect(claims).toMatchObject({ sub: 'u', role: 'authenticated' });
  });
});
