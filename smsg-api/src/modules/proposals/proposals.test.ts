import { describe, expect, it, vi } from 'vitest';

const consume = vi.hoisted(() => vi.fn());
vi.mock('../public/public.repo.js', () => ({ consumeRateLimit: consume }));

import { proposalBlocks, submit, uploadUrl } from './proposals.service.js';
import { ProposalSubmit } from './proposals.schemas.js';

const P = '2026/0a1b2c3d-0000-4000-8000-000000000001.webp';

describe('proposalBlocks', () => {
  it('splits paragraphs on blank lines and adds image and video', () => {
    const b = proposalBlocks(
      { body: 'Uno\ncontinua\n\n\nDue', videoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
      P,
    );
    expect(b.map((x) => x.type)).toEqual(['paragraph', 'paragraph', 'image', 'video']);
    expect(b[0]).toMatchObject({ content: [{ text: 'Uno continua' }] });
  });
  it('falls back to a link button for unknown video hosts', () => {
    const b = proposalBlocks({ body: 'x', videoUrl: 'https://example.test/v' });
    expect(b[1]).toMatchObject({ type: 'buttonLink', props: { label: 'Guarda il video' } });
  });
});

describe('ProposalSubmit', () => {
  const ok = {
    title: 'T',
    category: 'notizia',
    body: 'B',
    submitterName: 'N',
    turnstileToken: 't',
  };
  it('accepts a missing or empty token (Turnstile optional)', () => {
    const rest = { ...ok, turnstileToken: undefined };
    expect(ProposalSubmit.safeParse(rest).success).toBe(true);
    expect(ProposalSubmit.safeParse({ ...ok, turnstileToken: '' }).success).toBe(true);
  });
  it('validates the photo path and video url', () => {
    expect(ProposalSubmit.safeParse(ok).success).toBe(true);
    expect(ProposalSubmit.safeParse({ ...ok, photoPath: '../x.png' }).success).toBe(false);
    expect(ProposalSubmit.safeParse({ ...ok, videoUrl: 'http://x.it' }).success).toBe(false);
    expect(ProposalSubmit.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(ProposalSubmit.safeParse({ ...ok, videoUrl: '/interno' }).success).toBe(false);
    expect(ProposalSubmit.safeParse({ ...ok, videoUrl: 'https://' }).success).toBe(false);
    expect(ProposalSubmit.safeParse({ ...ok, videoUrl: 'https://x.it/v' }).success).toBe(true);
  });
});

describe('global proposal rate limits', () => {
  const body = { title: 'T', category: 'notizia', body: 'B', submitterName: 'N' } as never;
  const up = { size: 1, mime: 'image/webp' } as never;
  it('applies daily global caps after the per-IP ones', async () => {
    consume.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(uploadUrl(up, '1.1.1.1')).rejects.toMatchObject({ status: 429 });
    expect(consume).toHaveBeenNthCalledWith(1, 'proposal-upload:1.1.1.1', 5, 3600);
    expect(consume).toHaveBeenNthCalledWith(2, 'proposal-upload:global', 50, 86400);
    consume.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(submit(body, '1.1.1.1')).rejects.toMatchObject({ status: 429 });
    expect(consume).toHaveBeenNthCalledWith(2, 'proposal:global', 30, 86400);
  });
});
