import { describe, expect, it } from 'vitest';
import { proposalBlocks } from './proposals.service.js';
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
