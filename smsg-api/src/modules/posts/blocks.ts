import { z } from '@hono/zod-openapi';

// ADR-062 / ADR-022: whitelist of BlockNote blocks. Unknown props are stripped (z.object default),
// unknown types are rejected. Everything is stored as data and rendered escaped by React.
const MEDIA_PATH =
  /^\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png|mp4|webm)$/;
export const MediaPath = z.string().regex(MEDIA_PATH, 'Percorso media non valido');

// https://... or /path (no tel/mailto, no protocol-relative), ADR-043.
export const Href = z
  .string()
  .max(2000)
  .refine(
    (h) => (/^https:\/\/\S+$/.test(h) && URL.canParse(h)) || /^\/(?![/\\])[^\s\\]*$/.test(h),
    'Link non valido',
  );

const YT_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
];

/** Video id from a URL or a bare id; null when it does not parse. */
export function videoId(source: 'youtube' | 'vimeo', src: string): string | null {
  const s = src.trim();
  const re = source === 'youtube' ? /^[\w-]{11}$/ : /^\d{6,12}$/;
  if (re.test(s)) return s;
  if (!/^https:\/\//.test(s) || !URL.canParse(s)) return null;
  const u = new URL(s);
  const seg = u.pathname.split('/').filter(Boolean);
  let id: string | undefined;
  if (source === 'youtube') {
    if (u.hostname === 'youtu.be') id = seg[0];
    else if (YT_HOSTS.includes(u.hostname)) {
      if (u.pathname === '/watch') id = u.searchParams.get('v') ?? undefined;
      else if (['embed', 'shorts', 'live'].includes(seg[0] ?? '')) id = seg[1];
    }
  } else if (u.hostname === 'vimeo.com' || u.hostname === 'player.vimeo.com') {
    id = seg.at(-1);
  }
  return id && re.test(id) ? id : null;
}

/** Any supported video URL -> block props, or null. */
export function parseVideoUrl(url: string) {
  for (const source of ['youtube', 'vimeo'] as const) {
    const src = /^https:\/\//.test(url) ? videoId(source, url) : null;
    if (src) return { source, src };
  }
  return null;
}

const Styles = z
  .object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
  })
  .default({});
const Text = z.object({ type: z.literal('text'), text: z.string().max(5000), styles: Styles });
const Link = z.object({
  type: z.literal('link'),
  href: Href,
  content: z.array(Text).max(100),
});
const Content = z
  .array(z.discriminatedUnion('type', [Text, Link]))
  .max(500)
  .default([]);

const id = z.string().min(1).max(64);
const noProps = z.object({}).default({});
const noKids = z.array(z.unknown()).max(0).default([]);

const textual = <T extends string>(type: T) =>
  z.object({ id, type: z.literal(type), props: noProps, content: Content, children: noKids });
const listItem = <T extends 'bulletListItem' | 'numberedListItem'>(
  type: T,
  children: z.ZodType<unknown[]>,
) => z.object({ id, type: z.literal(type), props: noProps, content: Content, children });
const items = <K extends z.ZodType<unknown[]>>(kids: K) =>
  [listItem('bulletListItem', kids), listItem('numberedListItem', kids)] as const;

// Fixed depth (top + 2 nested levels), no z.lazy: keeps the OpenAPI schema finite.
const kids1 = z
  .array(z.discriminatedUnion('type', items(noKids)))
  .max(100)
  .default([]);
const kids2 = z
  .array(z.discriminatedUnion('type', items(kids1)))
  .max(100)
  .default([]);

const caption = z.string().max(300).default('');
const leaf = <T extends string, P extends z.ZodType>(type: T, props: P) =>
  z.object({ id, type: z.literal(type), props, children: noKids });

const Video = z
  .object({
    source: z.enum(['file', 'youtube', 'vimeo']),
    src: z.string().max(500),
    caption,
  })
  .refine(
    (p) =>
      p.source === 'file'
        ? MEDIA_PATH.test(p.src) && /\.(mp4|webm)$/.test(p.src)
        : videoId(p.source, p.src) !== null,
    { path: ['src'], message: 'Video non valido' },
  );

export const Block = z
  .discriminatedUnion('type', [
    textual('paragraph'),
    z.object({
      id,
      type: z.literal('heading'),
      props: z
        .object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1) })
        .default({ level: 1 }),
      content: Content,
      children: noKids,
    }),
    textual('quote'),
    ...items(kids2),
    leaf(
      'image',
      z.object({
        url: MediaPath,
        caption,
        previewWidth: z.number().int().min(100).max(2000).optional(),
      }),
    ),
    leaf(
      'gallery',
      z.object({
        paths: z.string().refine((s) => {
          const p = s.split(',');
          return p.length >= 1 && p.length <= 30 && p.every((x) => MEDIA_PATH.test(x));
        }, 'Elenco di percorsi media non valido'),
        caption,
      }),
    ),
    leaf('video', Video),
    leaf('buttonLink', z.object({ label: z.string().trim().min(1).max(80), href: Href })),
    leaf('divider', noProps),
  ])
  .openapi('Block');
export type Block = z.infer<typeof Block>;

export const Blocks = z
  .array(Block)
  .max(300)
  .refine((b) => Buffer.byteLength(JSON.stringify(b)) <= 256 * 1024, 'Contenuto troppo lungo');

/** Stores the video id, whatever the editor sent (URL or id). */
export const normalizeVideos = (blocks: Block[]): Block[] =>
  blocks.map((b) =>
    b.type === 'video' && b.props.source !== 'file'
      ? { ...b, props: { ...b.props, src: videoId(b.props.source, b.props.src)! } }
      : b,
  );

/** Every media path referenced by the content (image, gallery, file video). */
export const mediaPaths = (blocks: Block[]): string[] => [
  ...new Set(
    blocks.flatMap((b) =>
      b.type === 'image'
        ? [b.props.url]
        : b.type === 'gallery'
          ? b.props.paths.split(',')
          : b.type === 'video' && b.props.source === 'file'
            ? [b.props.src]
            : [],
    ),
  ),
];

type Inline = { type: 'text'; text: string } | { type: 'link'; content: { text: string }[] };
const inlineText = (c: Inline[]) =>
  c.map((i) => (i.type === 'text' ? i.text : i.content.map((t) => t.text).join(''))).join('');
const blockText = (b: Block): string[] =>
  'content' in b
    ? [
        inlineText(b.content as Inline[]),
        ...('children' in b ? (b.children as Block[]).flatMap(blockText) : []),
      ]
    : [];

/** Plain-text excerpt: whitespace collapsed, cut at a word, at most 259 characters + "…". */
export function excerptOf(blocks: Block[]): string | null {
  const all = blocks.flatMap(blockText).join(' ').replace(/\s+/g, ' ').trim();
  if (!all) return null;
  if (all.length <= 260) return all;
  const cut = all.slice(0, 259);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 0 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}
