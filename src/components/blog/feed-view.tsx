import Link from "next/link";
import { PostCard, type PostCardData } from "@/components/blog/post-card";
import { Pagination } from "@/components/pagination";
import "@/app/pixel-blog.css";

type Tag = { name: string; count: number };

export function FeedView({
  title,
  tab,
  list,
  tags,
  showFollowingTab,
  hrefFor,
  empty,
  top,
}: {
  title: React.ReactNode;
  tab?: "all" | "following";
  list: { items: PostCardData[]; page: number; pageCount: number; total: number };
  tags: Tag[];
  showFollowingTab: boolean;
  hrefFor: (n: number) => string;
  empty: React.ReactNode;
  /** 제목 아래 띠 (마을 게시판의 출석 체크, GAME-04) */
  top?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_260px]">
      <section className="min-w-0">
        <h1 className="pixel-sign mb-5 max-w-full break-words text-2xl sm:text-3xl">{title}</h1>
        {top}
        {tab && (
          <div className="mt-5 flex gap-3 px-[3px]">
            <Link href="/feed" aria-current={tab === "all" ? "page" : undefined} className="pixel-tab whitespace-nowrap text-sm">
              🏘 마을 전체
            </Link>
            {showFollowingTab && (
              <Link href="/feed/following" aria-current={tab === "following" ? "page" : undefined} className="pixel-tab whitespace-nowrap text-sm">
                💛 이웃 새 글
              </Link>
            )}
          </div>
        )}
        <div className="mt-6 grid gap-5">
          {list.items.length ? list.items.map((p) => <PostCard key={p.id} post={p} showAuthor />) : <div className="pixel-card p-10 text-center text-ink-soft">{empty}</div>}
        </div>
        <Pagination page={list.page} pageCount={list.pageCount} hrefFor={hrefFor} />
      </section>

      <aside className="md:sticky md:top-20 md:self-start">
        <div className="pixel-card">
          <h2 className="pb-plank px-4 py-2 font-display text-lg">🏷 인기 태그</h2>
          <div className="p-3">
          {tags.length ? (
            <ul className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <li key={t.name}>
                  <Link href={`/tags/${encodeURIComponent(t.name)}`} className="pixel-slot inline-flex min-h-11 items-center gap-1 whitespace-nowrap px-2.5 text-sm hover:bg-[#fff3d6] hover:text-leaf-dark">
                    #{t.name} <span className="text-ink-soft">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">아직 태그가 없어요</p>
          )}
          </div>
        </div>
      </aside>
    </div>
  );
}
