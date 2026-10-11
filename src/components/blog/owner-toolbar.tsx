// 내 블로그 주인 도구 막대 (사용자 요청 2026-10-11 "글쓰기랑 다른 부가기능들이 부족"): 티스토리 관리 메뉴처럼
// 큰 [✏️ 새 글 쓰기]와 글 관리·카테고리 관리·블로그 설정·꾸미기. 있는 화면으로만 잇는다.
// 프로필 카드의 [✏️ 글쓰기] [🎨 꾸미기] [⚙️ 관리]와 이름이 겹치지 않게 적는다 (시험이 이름으로 찾는다)
import Link from "next/link";

const tool = "btn min-h-11 min-w-11 gap-1 whitespace-nowrap bg-white px-3 text-sm text-ink";

export function OwnerToolbar({ postCount, privateCount }: { postCount: number; privateCount: number }) {
  return (
    <nav className="pixel-panel mt-6 flex flex-col gap-3 p-3 sm:flex-row sm:items-center" aria-label="내 블로그 관리" data-owner-toolbar>
      <Link href="/write" className="pixel-btn min-h-12 shrink-0 bg-leaf px-6 text-white">
        ✏️ 새 글 쓰기
      </Link>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Link href="/settings/posts" className={tool}>
          📝 글 관리 <span className="text-xs font-normal text-ink-soft">{postCount + privateCount}</span>
        </Link>
        <Link href="/settings/blog#categories" className={tool}>
          🗂 카테고리 관리
        </Link>
        <Link href="/settings/blog" className={tool}>
          ⚙️ 블로그 설정
        </Link>
        <Link href="/closet" className={tool}>
          🪞 옷장 꾸미기
        </Link>
      </div>
    </nav>
  );
}
