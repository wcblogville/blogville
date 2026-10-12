// 글 관리 (사용자 요청 2026-10-11 "내 블로그에 글쓰기랑 다른 부가기능들이 부족"): 내 글을 공개·비공개 모두 한눈에.
// 거르기(전체·공개·비공개)와 제목·본문 찾기, 글마다 [수정] [삭제]. 블로그 홈 주인 도구 막대의 [📝 글 관리]로 온다.
// 내 블로그 글만 읽는다 (blogId는 로그인한 회원의 블로그). 삭제는 deletePost가 다시 내 글인지 확인한다
import Form from "next/form";
import Link from "next/link";
import { DeletePostButton } from "@/components/blog/delete-post-button";
import { Pagination, parsePage } from "@/components/pagination";
import { parseSearchQuery, SEARCH_QUERY_MAX } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import { listBlogPosts } from "@/server/blog";
import { requireMember } from "@/server/dal";

export const metadata = { title: "글 관리" };

const MANAGE_PAGE_SIZE = 15;
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "public", label: "🌐 공개" },
  { key: "private", label: "🔒 비공개" },
] as const;

export default async function ManagePostsPage(props: PageProps<"/settings/posts">) {
  const viewer = await requireMember();
  const sp = await props.searchParams;
  const page = parsePage(sp.page);
  const vis = sp.vis === "public" || sp.vis === "private" ? sp.vis : undefined;
  const find = parseSearchQuery(sp.s);
  const q = find && !find.empty ? find.q : undefined;
  const list = await listBlogPosts({ blogId: viewer.profile.blogId, isOwner: true, visibility: vis, search: q, page, pageSize: MANAGE_PAGE_SIZE });
  const href = (over: { vis?: string; page?: number }) => {
    const params = new URLSearchParams();
    const v = "vis" in over ? over.vis : vis;
    if (v) params.set("vis", v);
    if (q) params.set("s", q);
    if (over.page && over.page > 1) params.set("page", String(over.page));
    const qs = params.toString();
    return `/settings/posts${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="pixel-sign text-2xl sm:text-3xl">📝 글 관리</h1>
        <Link href={`/@${viewer.profile.blogSlug}`} className="inline-flex min-h-11 min-w-11 items-center whitespace-nowrap px-1 text-sm text-ink-soft hover:text-ink">
          내 블로그로 →
        </Link>
      </div>

      <div className="pixel-panel mt-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <Link href="/write" className="pixel-btn min-h-12 shrink-0 bg-leaf px-5 text-white">
          ✏️ 새 글 쓰기
        </Link>
        <Form action="/settings/posts" className="flex min-w-0 flex-1 gap-3 p-[3px]" role="search" aria-label="내 글 찾기">
          {vis && <input type="hidden" name="vis" value={vis} />}
          <input
            name="s"
            defaultValue={q ?? ""}
            maxLength={SEARCH_QUERY_MAX}
            aria-label="내 글에서 찾을 말"
            placeholder="제목·본문으로 찾기"
            className="pixel-input min-w-0 text-sm"
          />
          <button className="pixel-btn pixel-btn-sm min-w-11 shrink-0 whitespace-nowrap bg-ink px-3 text-cream">찾기</button>
        </Form>
      </div>

      <nav className="mt-6 flex flex-wrap gap-3 px-[3px]" aria-label="공개 범위">
        {FILTERS.map((f) => {
          const on = (vis ?? "all") === f.key;
          return (
            <Link
              key={f.key}
              href={href({ vis: f.key === "all" ? undefined : f.key })}
              aria-current={on ? "page" : undefined}
              className="pixel-tab whitespace-nowrap text-sm"
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <p className="mt-5 text-sm text-ink-soft" data-manage-total>
        {q ? <>&apos;{q}&apos; 찾은 글 </> : "글 "}
        <b className="text-ink">{list.total}</b>개
      </p>

      {list.items.length ? (
        <ul className="pixel-card mt-3 divide-y-2 divide-dashed divide-[#e2c9a0]" data-manage-list>
          {list.items.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3" data-manage-post={p.id}>
              <div className="min-w-0 flex-1">
                <Link href={`/@${viewer.profile.blogSlug}/${p.id}`} className="flex min-h-11 min-w-0 items-center gap-2 hover:text-leaf-dark">
                  {p.visibility === "private" && <span className="pb-chip pb-chip-muted shrink-0 text-xs font-bold">🔒 비공개</span>}
                  <span className="truncate font-bold">{p.title}</span>
                </Link>
                <p className="flex flex-wrap gap-x-3 text-xs text-ink-soft">
                  <span>{formatDate(p.createdAt)}</span>
                  {p.categoryName && (
                    <span>
                      {p.categoryName}
                      {p.subcategoryName && ` › ${p.subcategoryName}`}
                    </span>
                  )}
                  <span>👀 {p.viewCount}</span>
                  <span>♥ {p.likeCount}</span>
                  <span>💬 {p.commentCount}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-3 p-[3px]">
                <Link href={`/write/${p.id}`} className="pixel-btn pixel-btn-sm min-w-11 whitespace-nowrap bg-[#fffaf0] px-3 text-leaf-dark">
                  수정
                </Link>
                <DeletePostButton postId={p.id} back="manage" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pixel-card mt-3 p-10 text-center text-ink-soft">
          <p className="text-4xl">🌱</p>
          <p className="mt-2">{q || vis ? "맞는 글이 없어요." : "아직 쓴 글이 없어요."}</p>
        </div>
      )}
      <Pagination page={list.page} pageCount={list.pageCount} hrefFor={(n) => href({ page: n })} />
    </div>
  );
}
