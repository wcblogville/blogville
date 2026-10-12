// 블로그 옆 칸 위젯 (사용자 요청 2026-10-11 "내 블로그 들어갔을 때 글쓰기랑 다른 부가기능들이 부족한 것 같음").
// 티스토리처럼: 블로그 검색, 카테고리(글 수), 최근 글, 인기 글, 최근 댓글, 태그, 방문자.
// 내용은 서버가 공개 범위를 지켜 읽은 것(getBlogSidebar)만 그린다. 비공개 글은 주인에게만 넘어온다
import Form from "next/form";
import Link from "next/link";
import type React from "react";
import { SEARCH_QUERY_MAX } from "@/lib/blog";
import { formatDate } from "@/lib/format";
import type { BlogSidebar } from "@/server/blog";
import { VisitWidget } from "./visit-widget";

/** 위젯 한 칸: 나무 이름표 제목 + 내용 */
export function Widget({ title, children, label, ...rest }: { title: React.ReactNode; children: React.ReactNode; label: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className="pb-card" aria-label={label} {...rest}>
      <h2 className="pb-plank px-4 py-2 font-display text-lg">{title}</h2>
      <div className="p-3">{children}</div>
    </section>
  );
}

const itemLink = "pb-row flex min-h-11 min-w-0 items-center gap-2 px-2 py-1 text-sm";

/** 블로그 안 검색 (모두에게): GET ?s= */
export function BlogFindBox({ base, s }: { base: string; s: string }) {
  return (
    <Widget title="🔍 블로그 검색" label="블로그 검색" data-widget="search">
      <Form action={base} className="flex gap-3 p-[3px]" role="search" aria-label="블로그 내 검색">
        <input
          name="s"
          defaultValue={s}
          maxLength={SEARCH_QUERY_MAX}
          aria-label="이 블로그에서 찾을 말"
          placeholder="이 블로그의 글 찾기"
          className="pixel-input min-w-0 text-sm"
        />
        <button className="pixel-btn min-h-11 min-w-11 shrink-0 whitespace-nowrap bg-ink px-3 pt-1.5 pb-2 text-sm text-cream">찾기</button>
      </Form>
    </Widget>
  );
}

type Post = BlogSidebar["recent"][number];

function PostLines({ base, posts, empty, rank = false }: { base: string; posts: Post[]; empty: string; rank?: boolean }) {
  if (!posts.length) return <p className="px-2 py-1 text-sm text-ink-soft">{empty}</p>;
  return (
    <ol className="space-y-0.5">
      {posts.map((p, i) => (
        <li key={p.id}>
          <Link href={`${base}/${p.id}`} className={itemLink}>
            {rank && (
              <span className={`grid h-6 w-6 shrink-0 place-items-center font-display text-xs ${i === 0 ? "pixel-wood" : "pb-slot text-ink-soft"}`}>
                {i + 1}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">
              {p.visibility === "private" && <span aria-label="비공개">🔒 </span>}
              {p.title}
            </span>
            <span className="shrink-0 text-xs text-ink-soft">{rank ? `👀 ${p.viewCount.toLocaleString("ko-KR")}` : formatDate(p.createdAt)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function RecentPostsWidget({ base, posts }: { base: string; posts: Post[] }) {
  return (
    <Widget title="📝 최근 글" label="최근 글" data-widget="recent">
      <PostLines base={base} posts={posts} empty="아직 글이 없어요" />
    </Widget>
  );
}

export function PopularPostsWidget({ base, posts }: { base: string; posts: Post[] }) {
  return (
    <Widget title="🔥 인기 글" label="인기 글" data-widget="popular">
      <PostLines base={base} posts={posts} empty="아직 읽힌 글이 없어요" rank />
    </Widget>
  );
}

export function RecentCommentsWidget({ base, comments }: { base: string; comments: BlogSidebar["comments"] }) {
  return (
    <Widget title="💬 최근 댓글" label="최근 댓글" data-widget="comments">
      {comments.length ? (
        <ul className="space-y-0.5">
          {comments.map((c) => (
            <li key={`${c.kind}-${c.id}`}>
              <Link href={`${base}/${c.postId}#${c.kind}-${c.id}`} className="pb-row block min-h-11 px-2 py-1.5 text-sm">
                <span className="line-clamp-1">
                  {c.kind === "reply" && <span className="text-ink-soft">↳ </span>}
                  {c.content}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  <b className="text-ink">{c.nickname ?? "탈퇴한 주민"}</b> · {c.postTitle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2 py-1 text-sm text-ink-soft">아직 댓글이 없어요</p>
      )}
    </Widget>
  );
}

export function TagsWidget({ base, tags, current }: { base: string; tags: BlogSidebar["tags"]; current: string | null }) {
  return (
    <Widget title="🏷 태그" label="태그 목록" data-widget="tags">
      {tags.length ? (
        <ul className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const on = t.name === current;
            return (
              <li key={t.name}>
                <Link
                  href={`${base}?tag=${encodeURIComponent(t.name)}`}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-1 whitespace-nowrap px-2.5 text-sm ${
                    on ? "bg-[#ffe7a3] font-bold shadow-[inset_0_0_0_3px_#d99a36]" : "pb-slot hover:bg-[#fff3d6] hover:text-leaf-dark"
                  }`}
                >
                  #{t.name} <span className="text-ink-soft">{t.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-2 py-1 text-sm text-ink-soft">아직 태그가 없어요</p>
      )}
    </Widget>
  );
}

export function VisitorsWidget({ blogId, initial, isOwner }: { blogId: number; initial: { today: number; yesterday: number; total: number }; isOwner: boolean }) {
  return (
    <Widget title="👣 방문자" label="방문자 수" data-widget="visitors">
      <VisitWidget blogId={blogId} initial={initial} isOwner={isOwner} />
    </Widget>
  );
}
