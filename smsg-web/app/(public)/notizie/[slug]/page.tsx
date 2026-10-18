import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostArticle } from "@/components/posts/post-article";
import { mediaUrl } from "@/lib/media-url";
import { getPost } from "@/lib/public/server";

export const revalidate = 3600;

const validSlug = (s: string) =>
  s.length <= 80 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!validSlug(slug)) return {};
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/notizie/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.cover
        ? [
            {
              url: mediaUrl(post.cover.path),
              width: post.cover.width ?? undefined,
              height: post.cover.height ?? undefined,
            },
          ]
        : undefined,
    },
  };
}

export default async function Articolo({ params }: Props) {
  const { slug } = await params;
  if (!validSlug(slug)) notFound();
  const post = await getPost(slug);
  if (!post) notFound();
  return (
    <div className="space-y-6">
      <PostArticle post={post} />
      <Link
        href="/notizie"
        className="inline-flex min-h-12 items-center font-bold text-blu underline underline-offset-4"
      >
        ← Tutti gli eventi e le novità
      </Link>
    </div>
  );
}
