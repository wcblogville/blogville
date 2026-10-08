import Link from "next/link";
import { PostCard, type PostCardData } from "@/components/blog/post-card";
import { Pagination } from "@/components/pagination";

type Tag = { name: string; count: number };

export function FeedView({
  title,
  tab,
  list,
  tags,
  showFollowingTab,
  hrefFor,
  empty,
}: {
  title: React.ReactNode;
  tab?: "all" | "following";
  list: { items: PostCardData[]; page: number; pageCount: number; total: number };
  tags: Tag[];
  showFollowingTab: boolean;
  hrefFor: (n: number) => string;
  empty: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_260px]">
      <section>
        <h1 className="font-display text-3xl">{title}</h1>
        {tab && (
          <div className="mt-4 flex gap-2">
            <Link href="/feed" className={`btn min-h-11 whitespace-nowrap py-1.5 text-sm ${tab === "all" ? "bg-ink text-cream" : "bg-white text-ink"}`}>
              🏘 마을 전체
            </Link>
            {showFollowingTab && (
              <Link href="/feed/following" className={`btn min-h-11 whitespace-nowrap py-1.5 text-sm ${tab === "following" ? "bg-ink text-cream" : "bg-white text-ink"}`}>
                💛 이웃 새 글
              </Link>
            )}
          </div>
        )}
        <div className="mt-5 grid gap-4">
          {list.items.length ? list.items.map((p) => <PostCard key={p.id} post={p} showAuthor />) : <div className="card p-10 text-center text-ink-soft">{empty}</div>}
        </div>
        <Pagination page={list.page} pageCount={list.pageCount} hrefFor={hrefFor} />
      </section>

      <aside className="md:sticky md:top-20 md:self-start">
        <div className="card p-4">
          <h2 className="mb-3 font-display text-lg">🏷 인기 태그</h2>
          {tags.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li key={t.name}>
                  <Link href={`/tags/${encodeURIComponent(t.name)}`} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-cream px-2.5 text-sm hover:text-leaf-dark">
                    #{t.name} <span className="text-ink-soft">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">아직 태그가 없어요</p>
          )}
        </div>
      </aside>
    </div>
  );
}
