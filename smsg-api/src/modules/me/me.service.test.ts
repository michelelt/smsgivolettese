import { describe, expect, it, vi } from 'vitest';

const row = vi.hoisted(() => ({ v: undefined as unknown }));
vi.mock('../../lib/ctx.js', () => ({
  asUser: (_c: unknown, f: (tx: unknown) => unknown) => f({}),
}));
vi.mock('./me.repo.js', () => ({ name: async () => row.v }));

const { profile } = await import('./me.service.js');
const ctx = { user: { id: 'u1' } } as never;

describe('me profile', () => {
  it('returns names', async () => {
    row.v = { firstName: 'Anna', lastName: 'Rossi' };
    expect(await profile(ctx)).toEqual({ firstName: 'Anna', lastName: 'Rossi' });
  });
  it('nulls when profile is missing', async () => {
    row.v = undefined;
    expect(await profile(ctx)).toEqual({ firstName: null, lastName: null });
  });
});
