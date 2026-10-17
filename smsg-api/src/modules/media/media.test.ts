import { describe, expect, it } from 'vitest';
import { CompleteBody, extMatches, UploadUrlBody } from './media.schemas.js';

describe('media', () => {
  it('matches extension to the real mime', () => {
    expect(extMatches('image/jpeg', 'jpeg')).toBe(true);
    expect(extMatches('image/jpeg', 'jpg')).toBe(true);
    expect(extMatches('image/png', 'webp')).toBe(false);
    expect(extMatches('text/html', 'png')).toBe(false);
  });
  it('whitelists mimes and paths', () => {
    expect(UploadUrlBody.safeParse({ kind: 'image', mime: 'image/gif', size: 1 }).success).toBe(
      false,
    );
    expect(CompleteBody.safeParse({ path: '2026/../x.png' }).success).toBe(false);
  });
});
