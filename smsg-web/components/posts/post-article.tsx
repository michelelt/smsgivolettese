import Image from "next/image";
import type { components } from "@/lib/api/schema";
import { fmtDate } from "@/lib/dates";
import { mediaUrl } from "@/lib/media-url";
import { CATEGORY } from "./post-card";
import { PostBody } from "./post-body";

type Post = Pick<
  components["schemas"]["PublicPost"],
  | "title"
  | "category"
  | "eventDate"
  | "location"
  | "cover"
  | "content"
  | "media"
>;

/** Shared by the public page and the staff preview (ADR-062). */
export function PostArticle({ post }: { post: Post }) {
  return (
    <article className="max-w-3xl space-y-5">
      <header className="space-y-2">
        <p className="font-bold text-blu">
          {CATEGORY[post.category]}
          {post.eventDate ? ` · ${fmtDate(post.eventDate)}` : ""}
          {post.location ? ` · ${post.location}` : ""}
        </p>
        <h1 className="text-3xl font-extrabold text-bordeaux">{post.title}</h1>
      </header>
      {post.cover && (
        <Image
          src={mediaUrl(post.cover.path)}
          alt={post.cover.alt ?? ""}
          width={post.cover.width || 1600}
          height={post.cover.height || 1200}
          sizes="(min-width: 768px) 768px, 100vw"
          priority
          style={{ height: "auto", width: "100%" }}
          className="rounded-xl"
        />
      )}
      <PostBody
        blocks={post.content}
        media={post.media.filter((m) => m !== null)}
      />
    </article>
  );
}
