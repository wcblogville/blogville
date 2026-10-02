import Link from "next/link";
import { CharacterBadge } from "@/components/character";
import { formatDate } from "@/lib/format";

export type PostCardData = {
  id: number;
  title: string;
  excerpt: string;
  visibility: "public" | "private";
  createdAt: Date;
  categoryName: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  blogSlug: string;
  blogTitle: string;
  nickname: string;
  characterAsset: string;
};

/** 글 목록 한 칸. showAuthor: 마을 소식처럼 여러 블로그 글이 섞일 때 작성자 표시 */
export function PostCard({ post, showAuthor = false }: { post: PostCardData; showAuthor?: boolean }) {
  return (
    <article className="card p-5 transition hover:-translate-y-0.5">
      {showAuthor && (
        <Link href={`/@${post.blogSlug}`} className="mb-2 flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
          <CharacterBadge asset={post.characterAsset} size={26} />
          <b className="text-ink">{post.nickname}</b>
          <span className="truncate">· {post.blogTitle}</span>
        </Link>
      )}
      <Link href={`/@${post.blogSlug}/${post.id}`} className="block">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold">
          {post.categoryName && <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-sun-dark">{post.categoryName}</span>}
          {post.visibility === "private" && <span className="rounded-full bg-ink/10 px-2 py-0.5 text-ink-soft">🔒 비공개</span>}
        </div>
        <h3 className="font-display text-xl leading-snug">{post.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-soft">{post.excerpt}</p>
        <p className="mt-3 flex gap-3 text-xs text-ink-soft">
          <span>{formatDate(post.createdAt)}</span>
          <span>♥ {post.likeCount}</span>
          <span>💬 {post.commentCount}</span>
          <span>👀 {post.viewCount}</span>
        </p>
      </Link>
    </article>
  );
}
