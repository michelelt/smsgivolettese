import Image from "next/image";
import Link from "next/link";
import { mediaUrl } from "@/lib/media-url";
import { bigButtonClass } from "@/components/ui/button";
import { VideoEmbed } from "./video-embed";
import { LightboxGroup, type LightboxItem } from "./lightbox";
import {
  MEDIA_PATH,
  VIMEO_ID,
  YOUTUBE_ID,
  type ApiBlock,
  type Block,
  type Inline,
  type PostMedia,
} from "./block-types";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const safeHref = (h: string) => /^(https:\/\/|\/(?!\/))/.test(h);

function Inlines({ nodes }: { nodes?: Inline[] }) {
  return nodes?.map((n, i) => {
    if (n.type === "link") {
      if (!safeHref(n.href)) return <Inlines key={i} nodes={n.content} />;
      const inner = <Inlines nodes={n.content} />;
      const cls = "font-bold text-blu underline underline-offset-2";
      return n.href.startsWith("/") ? (
        <Link key={i} href={n.href} className={cls}>
          {inner}
        </Link>
      ) : (
        <a key={i} href={n.href} rel="noopener noreferrer" className={cls}>
          {inner}
        </a>
      );
    }
    if (n.type !== "text") return null;
    let el: React.ReactNode = n.text;
    if (n.styles?.bold) el = <strong>{el}</strong>;
    if (n.styles?.italic) el = <em>{el}</em>;
    if (n.styles?.underline) el = <u>{el}</u>;
    return <span key={i}>{el}</span>;
  });
}

type Ctx = { media: Map<string, PostMedia> };

function Photo({
  path,
  ctx,
  caption,
  index,
}: {
  path: string;
  ctx: Ctx;
  caption?: string;
  index: number;
}) {
  if (!MEDIA_PATH.test(path)) return null;
  const m = ctx.media.get(path);
  const src = mediaUrl(path);
  return (
    <a
      href={src}
      data-lightbox={index}
      aria-label={caption ? undefined : `Apri la foto ${index + 1} ingrandita`}
      className="block"
    >
      <Image
        src={src}
        alt={m?.alt || caption || ""}
        width={m?.width || 1600}
        height={m?.height || 1200}
        sizes="(min-width: 768px) 768px, 100vw"
        style={{ height: "auto", width: "100%" }}
        className="rounded-xl"
      />
    </a>
  );
}

const item = (path: string, ctx: Ctx, caption?: string): LightboxItem => ({
  src: mediaUrl(path),
  alt: ctx.media.get(path)?.alt || caption || "",
  caption,
});

function Cap({ text }: { text: string }) {
  return text ? (
    <figcaption className="mt-2 text-base text-ink/80">{text}</figcaption>
  ) : null;
}

function One({ b, ctx }: { b: Block; ctx: Ctx }) {
  const p = b.props;
  switch (b.type) {
    case "paragraph":
      return (
        <p>
          <Inlines nodes={b.content} />
        </p>
      );
    case "heading": {
      const cls = "font-extrabold text-bordeaux";
      const l = Number(p.level);
      return l === 1 ? (
        <h2 className={`text-3xl ${cls}`}>
          <Inlines nodes={b.content} />
        </h2>
      ) : l === 2 ? (
        <h3 className={`text-2xl ${cls}`}>
          <Inlines nodes={b.content} />
        </h3>
      ) : (
        <h4 className={`text-xl ${cls}`}>
          <Inlines nodes={b.content} />
        </h4>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-4 border-bordeaux pl-4 italic">
          <Inlines nodes={b.content} />
        </blockquote>
      );
    case "image": {
      const path = str(p.url);
      if (!MEDIA_PATH.test(path)) return null;
      const w = Number(p.previewWidth);
      const caption = str(p.caption);
      return (
        <figure style={w >= 100 && w <= 2000 ? { maxWidth: w } : undefined}>
          <LightboxGroup items={[item(path, ctx, caption)]}>
            <Photo path={path} ctx={ctx} caption={caption} index={0} />
          </LightboxGroup>
          <Cap text={caption} />
        </figure>
      );
    }
    case "gallery": {
      const paths = str(p.paths)
        .split(",")
        .filter((x) => MEDIA_PATH.test(x));
      if (!paths.length) return null;
      const caption = str(p.caption);
      return (
        <figure>
          <LightboxGroup items={paths.map((x) => item(x, ctx))}>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {paths.map((x, i) => (
                <li key={x}>
                  <Photo path={x} ctx={ctx} index={i} />
                </li>
              ))}
            </ul>
          </LightboxGroup>
          <Cap text={caption} />
        </figure>
      );
    }
    case "video": {
      const src = str(p.src);
      const caption = str(p.caption);
      const source = str(p.source);
      let media: React.ReactNode = null;
      if (source === "file" && MEDIA_PATH.test(src))
        media = (
          <video
            controls
            preload="metadata"
            src={mediaUrl(src)}
            className="w-full rounded-xl"
          />
        );
      else if (source === "youtube" && YOUTUBE_ID.test(src))
        media = (
          <VideoEmbed
            provider="YouTube"
            src={`https://www.youtube-nocookie.com/embed/${src}`}
            title={caption}
          />
        );
      else if (source === "vimeo" && VIMEO_ID.test(src))
        media = (
          <VideoEmbed
            provider="Vimeo"
            src={`https://player.vimeo.com/video/${src}?dnt=1`}
            title={caption}
          />
        );
      if (!media) return null;
      return (
        <figure>
          {media}
          <Cap text={caption} />
        </figure>
      );
    }
    case "buttonLink": {
      const href = str(p.href);
      if (!safeHref(href)) return null;
      return href.startsWith("/") ? (
        <Link href={href} className={bigButtonClass()}>
          {str(p.label)}
        </Link>
      ) : (
        <a href={href} rel="noopener noreferrer" className={bigButtonClass()}>
          {str(p.label)}
        </a>
      );
    }
    case "divider":
      return <hr className="border-t-2 border-ink/30" />;
    default:
      return null; // whitelist: unknown types are ignored (ADR-022)
  }
}

const LIST = { bulletListItem: "ul", numberedListItem: "ol" } as const;

function Items({ blocks, ctx }: { blocks: Block[]; ctx: Ctx }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const tag = LIST[b.type as keyof typeof LIST];
    if (!tag) {
      out.push(<One key={b.id} b={b} ctx={ctx} />);
      continue;
    }
    const run: Block[] = [];
    while (i < blocks.length && blocks[i].type === b.type)
      run.push(blocks[i++]);
    i--;
    const Tag = tag;
    out.push(
      <Tag
        key={b.id}
        className={`ml-6 space-y-1 ${tag === "ul" ? "list-disc" : "list-decimal"}`}
      >
        {run.map((li) => (
          <li key={li.id}>
            <Inlines nodes={li.content} />
            {li.children.length > 0 && <Items blocks={li.children} ctx={ctx} />}
          </li>
        ))}
      </Tag>,
    );
  }
  return out;
}

/** Whitelist renderer for stored BlockNote JSON (ADR-022/062). Server Component. */
export function PostBody({
  blocks,
  media = [],
}: {
  blocks: ApiBlock[];
  media?: PostMedia[];
}) {
  const ctx = { media: new Map(media.map((m) => [m.path, m])) };
  return (
    <div className="space-y-5 text-lg leading-relaxed">
      <Items blocks={blocks as unknown as Block[]} ctx={ctx} />
    </div>
  );
}
