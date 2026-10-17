import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  lock: vi.fn(),
  setActive: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  del: vi.fn(),
}));
vi.mock('../../lib/db.js', () => ({
  db: { asService: (fn: (tx: unknown) => unknown) => fn({}) },
}));
vi.mock('../../lib/ctx.js', () => ({
  asUser: (_c: unknown, fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock('./users.repo.js', () => ({
  lockRole: h.lock,
  setActive: h.setActive,
  setRole: vi.fn(),
  upsertVolunteer: vi.fn(),
  deactivateVolunteer: vi.fn(),
  get: vi.fn(async () => ({ id: 'x' })),
  auditMfaReset: h.audit,
}));
vi.mock('../../lib/supabase-admin.js', () => ({
  supabaseAdmin: () => ({
    auth: {
      admin: {
        updateUserById: h.update,
        mfa: {
          listFactors: async () => ({ data: { factors: [{ id: 'f1' }] }, error: null }),
          deleteFactor: h.del,
        },
      },
    },
  }),
}));

import { changeRole, deactivate, invite, reactivate, resetMfa } from './users.service.js';
import { CountersInput } from '../org-settings/org-settings.schemas.js';

const ctx = { user: { id: 'me', role: 'super_admin' as const } };

describe('users lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.update.mockResolvedValue({ error: null });
  });

  it('refuses to demote or deactivate the only super admin', async () => {
    h.lock.mockResolvedValue({ role: 'super_admin', active: true, otherSuperAdmin: false });
    await expect(changeRole(ctx, 'u', 'staff')).rejects.toMatchObject({ code: 'LAST_SUPER_ADMIN' });
    await expect(deactivate(ctx, 'u')).rejects.toMatchObject({
      status: 409,
      code: 'LAST_SUPER_ADMIN',
    });
    expect(h.update).not.toHaveBeenCalled();
  });

  it('bans in Auth after the DB flip, and unbans on reactivate', async () => {
    h.lock.mockResolvedValue({ role: 'staff', active: true, otherSuperAdmin: true });
    h.setActive.mockResolvedValue(1);
    await deactivate(ctx, 'u');
    expect(h.update).toHaveBeenCalledWith('u', { ban_duration: '876000h' });
    await reactivate(ctx, 'u');
    expect(h.update).toHaveBeenLastCalledWith('u', { ban_duration: 'none' });
  });

  it('maps no-op flips to USER_INVALID_TRANSITION and Auth errors to 502 (tx throws)', async () => {
    h.lock.mockResolvedValue({ role: 'staff', active: false, otherSuperAdmin: true });
    h.setActive.mockResolvedValue(0);
    await expect(deactivate(ctx, 'u')).rejects.toMatchObject({ code: 'USER_INVALID_TRANSITION' });
    h.setActive.mockResolvedValue(1);
    h.update.mockResolvedValue({ error: { status: 500 } });
    await expect(deactivate(ctx, 'u')).rejects.toMatchObject({
      status: 502,
      code: 'AUTH_SYNC_FAILED',
    });
  });

  it('404 for unknown user', async () => {
    h.lock.mockResolvedValue(undefined);
    await expect(deactivate(ctx, 'u')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});

describe('users hardening', () => {
  it('audits the MFA reset only after the factors are deleted', async () => {
    h.del.mockResolvedValue({ error: null });
    expect(await resetMfa(ctx, 'u')).toEqual({ removed: 1 });
    expect(h.audit).toHaveBeenCalledWith({}, 'u', 1, undefined);
    h.audit.mockClear();
    h.del.mockResolvedValue({ error: { status: 500 } });
    await expect(resetMfa(ctx, 'u')).rejects.toMatchObject({ status: 502 });
    expect(h.audit).not.toHaveBeenCalled();
    await expect(resetMfa(ctx, 'me')).rejects.toMatchObject({ code: 'SELF_FORBIDDEN' });
  });

  it('refuses role changes on anonymised users', async () => {
    h.lock.mockResolvedValue({
      role: 'staff',
      active: false,
      anonymized: true,
      otherSuperAdmin: true,
    });
    await expect(changeRole(ctx, 'u', 'volontario')).rejects.toMatchObject({
      code: 'USER_INVALID_TRANSITION',
    });
  });

  it('invite of staff by a pending-MFA super admin is MFA_REQUIRED, by plain staff FORBIDDEN', async () => {
    const body = { email: 'a@b.it', firstName: 'A', lastName: 'B', role: 'staff' as const };
    await expect(
      invite({ user: { id: 'me', role: 'staff', mfaPending: true } }, body),
    ).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
    await expect(invite({ user: { id: 'me', role: 'staff' } }, body)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('CountersInput', () => {
  it('needs a change and year+number together', () => {
    expect(CountersInput.safeParse({}).success).toBe(false);
    expect(CountersInput.safeParse({ invoiceYear: 2026 }).success).toBe(false);
    expect(CountersInput.safeParse({ invoiceYear: 2026, invoiceLastNumber: 5 }).success).toBe(true);
    expect(CountersInput.safeParse({ lastCardNumber: 10 }).success).toBe(true);
  });
});
