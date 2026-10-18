import { describe, expect, it } from 'vitest';
import {
  Block,
  Blocks,
  excerptOf,
  mediaPaths,
  normalizeVideos,
  parseVideoUrl,
  videoId,
} from './blocks.js';
import { slugify } from './posts.service.js';

const P = '2026/0a1b2c3d-0000-4000-8000-000000000001.webp';
const t = (text: string) => ({ type: 'text', text, styles: {} });
const para = (content: unknown[], extra: object = {}) => ({
  id: 'x',
  type: 'paragraph',
  props: {},
  content,
  children: [],
  ...extra,
});

describe('Block schema (ADR-062)', () => {
  it('accepts the seeded content shape', () => {
    const seeded = [
      { id: 'b1', type: 'heading', props: { level: 1 }, content: [t('Titolo')], children: [] },
      para([
        { type: 'text', text: 'Testo ', styles: { bold: true } },
        { type: 'link', href: 'https://example.test', content: [t('link')] },
      ]),
      {
        id: 'b4',
        type: 'bulletListItem',
        props: {},
        content: [t('Uno')],
        children: [
          { id: 'b5', type: 'bulletListItem', props: {}, content: [t('Due')], children: [] },
        ],
      },
      {
        id: 'b7',
        type: 'video',
        props: { source: 'youtube', src: 'dQw4w9WgXcQ', caption: 'x' },
        children: [],
      },
      { id: 'b8', type: 'buttonLink', props: { label: 'Vai', href: '/chi-siamo' }, children: [] },
      { id: 'b9', type: 'divider', props: {}, children: [] },
    ];
    expect(Blocks.safeParse(seeded).success).toBe(true);
  });

  it('rejects unknown types and unsafe links', () => {
    expect(Block.safeParse({ id: 'x', type: 'script', props: {}, children: [] }).success).toBe(
      false,
    );
    for (const href of [
      'javascript:alert(1)',
      'mailto:a@b.it',
      'tel:123',
      '//evil.test',
      'http://x.it',
    ])
      expect(Block.safeParse(para([{ type: 'link', href, content: [t('a')] }])).success).toBe(
        false,
      );
  });

  it('strips unknown props and styles, keeps text as data', () => {
    const r = Block.parse(
      para(
        [
          {
            type: 'text',
            text: '<img src=x onerror=alert(1)>',
            styles: { textColor: 'red', bold: true },
          },
        ],
        {
          props: { textColor: 'red', onclick: 'x' },
        },
      ),
    );
    expect(r).toMatchObject({
      props: {},
      content: [{ text: '<img src=x onerror=alert(1)>', styles: { bold: true } }],
    });
  });

  it('allows only list items to nest, up to two levels below the top', () => {
    const li = (children: unknown[]) => ({
      id: 'l',
      type: 'numberedListItem',
      props: {},
      content: [],
      children,
    });
    expect(Block.safeParse(li([li([li([])])])).success).toBe(true);
    expect(Block.safeParse(li([li([li([li([])])])])).success).toBe(false);
    expect(Block.safeParse(para([], { children: [li([])] })).success).toBe(false);
  });

  it('checks media paths and video sources', () => {
    const img = (url: string) => ({ id: 'i', type: 'image', props: { url }, children: [] });
    expect(Block.safeParse(img(P)).success).toBe(true);
    expect(Block.safeParse(img('../../etc/passwd')).success).toBe(false);
    expect(Block.safeParse(img('https://evil.test/a.png')).success).toBe(false);
    const vid = (props: object) => ({ id: 'v', type: 'video', props, children: [] });
    expect(Block.safeParse(vid({ source: 'file', src: P })).success).toBe(false); // webp is not a video
    expect(Block.safeParse(vid({ source: 'file', src: P.replace('webp', 'mp4') })).success).toBe(
      true,
    );
    expect(Block.safeParse(vid({ source: 'youtube', src: 'not a url' })).success).toBe(false);
  });

  it('limits the number of blocks', () => {
    expect(Blocks.safeParse(Array.from({ length: 301 }, () => para([]))).success).toBe(false);
  });
});

describe('video ids', () => {
  it('stores the id for URLs and bare ids', () => {
    expect(videoId('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoId('youtube', 'https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('dQw4w9WgXcQ');
    expect(videoId('youtube', 'https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(videoId('youtube', 'https://evil.test/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(videoId('vimeo', 'https://vimeo.com/123456789')).toBe('123456789');
    expect(videoId('vimeo', '123456789')).toBe('123456789');
    expect(parseVideoUrl('https://example.test/v')).toBeNull();
    expect(parseVideoUrl('https://vimeo.com/123456789')).toEqual({
      source: 'vimeo',
      src: '123456789',
    });
  });
  it('normalizeVideos rewrites URL sources to ids', () => {
    const [b] = normalizeVideos(
      Blocks.parse([
        {
          id: 'v',
          type: 'video',
          props: { source: 'youtube', src: 'https://youtu.be/dQw4w9WgXcQ' },
          children: [],
        },
      ]),
    );
    expect(b).toMatchObject({ props: { src: 'dQw4w9WgXcQ' } });
  });
});

describe('derived data', () => {
  it('collects media paths once', () => {
    const blocks = Blocks.parse([
      { id: 'i', type: 'image', props: { url: P }, children: [] },
      { id: 'g', type: 'gallery', props: { paths: `${P},${P.replace('01', '02')}` }, children: [] },
    ]);
    expect(mediaPaths(blocks)).toHaveLength(2);
  });
  it('builds a word-cut excerpt of at most 260 chars', () => {
    expect(excerptOf(Blocks.parse([para([t('  Ciao \n  mondo ')])]))).toBe('Ciao mondo');
    expect(excerptOf([])).toBeNull();
    const long = excerptOf(Blocks.parse([para([t('parola '.repeat(100))])]))!;
    expect(long.length).toBeLessThanOrEqual(260);
    expect(long.endsWith('parola…')).toBe(true);
  });
});

describe('slugify', () => {
  it('strips diacritics and symbols, caps at 80', () => {
    expect(slugify('Festa dell’Estate: già pronti!')).toBe('festa-dell-estate-gia-pronti');
    expect(slugify('???')).toBe('articolo');
    expect(slugify('a'.repeat(200))).toHaveLength(80);
    expect(slugify('ab cd', 3)).toBe('ab');
  });
});
