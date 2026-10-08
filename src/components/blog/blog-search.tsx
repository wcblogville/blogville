// 내 블로그에서 마을의 글·블로그 검색 (BLOG-06 검색 / FR-050~053, contracts/blog-home.md 1.4, research R-15~R-17)
// 검색창과 결과는 주인에게만 그린다 (판정은 페이지 서버 코드). 광장·마을 소식·남의 블로그에는 없다 (SC-013).
// plan 임시 문구: 안내 `마을의 글·블로그 검색`, [검색], 제목 `🔍 '{검색어}' 검색 결과`, 묶음 `블로그`·`글 N개`.
import Form from "next/form";
import Link from "next/link";
import { OwnerAvatar } from "@/components/blog/blog-header";
import { PostCard, type PostCardData } from "@/components/blog/post-card";
import { SEARCH_QUERY_MAX } from "@/lib/blog";

/** 검색창: GET으로 /@{내 주소}?q=검색어 (next/form, 화면 안 이동) */
export function BlogSearchBox({ base, q }: { base: string; q: string }) {
  return (
    <Form action={base} className="card mb-4 flex gap-2 p-3" role="search">
      <input
        name="q"
        defaultValue={q}
        maxLength={SEARCH_QUERY_MAX}
        aria-label="검색어"
        placeholder="마을의 글·블로그 검색"
        className="min-h-11 w-full min-w-0 rounded-xl border-2 border-line bg-white px-3 text-sm outline-none focus:border-sun"
      />
      <button className="btn min-h-11 min-w-11 shrink-0 whitespace-nowrap bg-ink px-3 text-cream">검색</button>
    </Form>
  );
}

type FoundBlog = { slug: string; title: string; nickname: string; characterAsset: string; photoKey: string | null };

/** 검색 결과: 1페이지에만 블로그 묶음, 그 아래 공개 글 카드 (작성자 표시) */
export function BlogSearchResults({
  q,
  empty,
  blogs,
  posts,
  total,
}: {
  q: string;
  empty: boolean;
  blogs: FoundBlog[];
  posts: PostCardData[];
  total: number;
}) {
  if (empty) return <p className="card p-10 text-center text-ink-soft">검색어를 적어 주세요</p>;
  return (
    <div>
      <h2 className="mb-3 font-display text-xl break-words">🔍 &apos;{q}&apos; 검색 결과</h2>
      {blogs.length === 0 && total === 0 ? (
        <p className="card p-10 text-center text-ink-soft">검색 결과가 없어요</p>
      ) : (
        <>
          {blogs.length > 0 && (
            <section aria-labelledby="found-blogs" className="mb-5">
              <h3 id="found-blogs" className="mb-2 font-display text-lg">블로그</h3>
              <ul className="card divide-y-2 divide-line/60">
                {blogs.map((b) => (
                  <li key={b.slug}>
                    <Link href={`/@${b.slug}`} className="flex min-h-11 items-center gap-3 px-4 py-2 hover:bg-cream">
                      <OwnerAvatar photoKey={b.photoKey} characterAsset={b.characterAsset} nickname={b.nickname} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          <b>{b.nickname}</b> · {b.title}
                        </span>
                        <span className="block truncate text-xs text-ink-soft">@{b.slug}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="found-posts">
            <h3 id="found-posts" className="mb-2 font-display text-lg">글 {total}개</h3>
            <div className="grid gap-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} showAuthor />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
