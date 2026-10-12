import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import type { PinnedNotice } from "@/server/blog";

/**
 * 마을 소식 맨 위에 걸린 공지 (사용자 요청 2026-10-12). 글 목록 카드(<article>)와 따로 센다: <section>.
 * 앞부분 몇 줄만 보여 주고 [📖 전체 읽기]로 공지 블로그의 글 상세에 간다 (방문자도 읽을 수 있다)
 */
export function PinnedNoticeCard({ notice }: { notice: PinnedNotice }) {
  const href = `/@${notice.blogSlug}/${notice.id}`;
  return (
    <section className="pixel-card relative mt-10 p-4 pt-7 sm:p-5 sm:pt-8" aria-labelledby="pinned-notice-title" data-pinned-notice>
      <span className="pixel-sign absolute -top-4 left-4 gap-1.5 px-2.5 py-0.5 text-base sm:text-lg">
        <PixelIcon name="board" scale={2} />
        공지사항
      </span>
      <h2 id="pinned-notice-title" className="font-display text-lg leading-snug break-words sm:text-xl">
        <Link href={href} className="hover:text-leaf-dark hover:underline">
          {notice.title}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-3 whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">{notice.excerpt}</p>
      <div className="mt-3 flex justify-end">
        <Link href={href} className="pixel-btn pixel-btn-sm min-h-11 bg-[#fffaf0] text-ink">
          <PixelIcon name="book" scale={1} />전체 읽기 →
        </Link>
      </div>
    </section>
  );
}
