import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ anon: vi.fn(), update: vi.fn() }));
vi.mock('../../lib/ctx.js', () => ({
  asUser: (_c: unknown, fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock('./gdpr.repo.js', () => ({
  anonymize: h.anon,
  exportData: vi.fn(async () => ({ member: { cardNumber: 42 } })),
}));
vi.mock('../../lib/supabase-admin.js', () => ({
  supabaseAdmin: () => ({ auth: { admin: { updateUserById: h.update } } }),
}));

import { anonymize, exportData } from './gdpr.service.js';

const ctx = { user: { id: 'me', role: 'super_admin' as const } };
const id = '11111111-1111-4111-8111-111111111111';

describe('gdpr service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.anon.mockResolvedValue({ retainedInvoices: [{ id, year: 2026, number: 1 }] });
  });

  it('names the member export after the card number', async () => {
    const f = await exportData(ctx, 'member', id);
    expect(f.filename).toMatch(/^dati-socio-42-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('member anonymisation never touches Auth', async () => {
    const r = await anonymize(ctx, { subject: 'member', id });
    expect(r.retainedInvoices).toHaveLength(1);
    expect(h.update).not.toHaveBeenCalled();
  });

  it('user anonymisation syncs Auth after commit; failure is 502', async () => {
    h.update.mockResolvedValue({ error: null });
    await anonymize(ctx, { subject: 'user', id });
    expect(h.update).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ ban_duration: '876000h', email: `deleted+${id}@invalid.local` }),
    );
    h.update.mockResolvedValue({ error: { status: 500 } });
    await expect(anonymize(ctx, { subject: 'user', id })).rejects.toMatchObject({
      status: 502,
      code: 'AUTH_SYNC_FAILED',
    });
  });
});
