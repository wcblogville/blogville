import Link from "next/link";
import { MiniRoom } from "@/components/character";
import { toggleFollow } from "@/app/blog/actions";

type Blog = {
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
export function BlogHeader({ blog, viewerId, following }: { blog: Blog; viewerId: string | null; following: boolean }) {
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
            <h1 className="font-display text-2xl sm:text-3xl">{blog.title}</h1>
          </Link>
          {blog.description && <p className="mt-1 text-ink-soft">{blog.description}</p>}
          <p className="mt-2 text-sm text-ink-soft">
            @{blog.slug} · 글 {blog.postCount} · 이웃 {blog.followerCount}
          </p>
        </div>
        {/* 좁은 화면에서는 버튼 3개를 한 줄에 같은 너비로 놓고, 글자가 두 줄로 깨지지 않게 한다 (이슈 #5) */}
        <div className={isOwner ? "grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto" : "flex gap-2"}>
          {isOwner ? (
            <>
              <Link href="/write" className="btn whitespace-nowrap bg-leaf text-white max-sm:gap-1 max-sm:px-2 max-sm:text-sm">✏️ 글쓰기</Link>
              <Link href="/closet" className="btn whitespace-nowrap bg-white text-ink max-sm:gap-1 max-sm:px-2 max-sm:text-sm">🎨 꾸미기</Link>
              <Link href="/settings/blog" className="btn whitespace-nowrap bg-white text-ink max-sm:gap-1 max-sm:px-2 max-sm:text-sm">⚙️ 관리</Link>
            </>
          ) : viewerId ? (
            <form action={toggleFollow.bind(null, blog.ownerId)}>
              <button className={`btn whitespace-nowrap ${following ? "bg-white text-ink" : "bg-sky text-white"}`}>
                {following ? "✓ 이웃" : "+ 이웃 추가"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
