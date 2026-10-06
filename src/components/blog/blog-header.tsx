import Link from "next/link";
import { MiniRoom } from "@/components/character";
import { toggleFollow } from "@/app/blog/actions";
import { VisitCount } from "./visit-count";

type Blog = {
  id: number;
  slug: string;
  title: string;
  description: string;
  ownerId: string;
  nickname: string;
  characterAsset: string;
  backgroundAsset: string;
  followerCount: number;
  postCount: number;
};

/** 블로그 상단: 미니룸 + 블로그 정보 */
export function BlogHeader({
  blog,
  viewerId,
  following,
  visits,
}: {
  blog: Blog;
  viewerId: string | null;
  following: boolean;
  visits: { today: number; total: number };
}) {
  const isOwner = viewerId === blog.ownerId;
  return (
    <section className="card overflow-hidden">
      <MiniRoom
        characterAsset={blog.characterAsset}
        backgroundAsset={blog.backgroundAsset}
        nickname={blog.nickname}
        className="h-56 border-b-2 border-line sm:h-64"
      />
      <div className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <Link href={`/@${blog.slug}`}>
            <h1 className="font-display text-3xl">{blog.title}</h1>
          </Link>
          {blog.description && <p className="mt-1 text-ink-soft">{blog.description}</p>}
          <p className="mt-2 text-sm text-ink-soft">
            @{blog.slug} · 글 {blog.postCount} · 이웃 {blog.followerCount} ·{" "}
            <VisitCount blogId={blog.id} initial={visits} isOwner={isOwner} />
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner ? (
            <>
              <Link href="/write" className="btn bg-leaf text-white">✏️ 글쓰기</Link>
              <Link href="/closet" className="btn bg-white text-ink">🎨 꾸미기</Link>
              <Link href="/settings/blog" className="btn bg-white text-ink">⚙️ 관리</Link>
            </>
          ) : viewerId ? (
            <form action={toggleFollow.bind(null, blog.ownerId)}>
              <button className={`btn ${following ? "bg-white text-ink" : "bg-sky text-white"}`}>
                {following ? "✓ 이웃" : "+ 이웃 추가"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
