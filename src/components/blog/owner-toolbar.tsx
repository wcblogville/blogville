// 내 블로그 주인 도구 막대 (사용자 요청 2026-10-11 "글쓰기랑 다른 부가기능들이 부족"): 티스토리 관리 메뉴처럼
// 큰 [✏️ 새 글 쓰기]와 글 관리·카테고리 관리·블로그 설정·꾸미기. 있는 화면으로만 잇는다.
// 주인 버튼은 여기 한 곳이다 (프로필 카드의 [✏️ 글쓰기] [🎨 꾸미기] [⚙️ 관리]는 카드와 함께 없앰, 2026-10-11)
import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";

const tool = "pixel-btn pixel-btn-sm min-w-11 gap-1 whitespace-nowrap bg-[#fffaf0] px-3 text-ink";

export function OwnerToolbar({ postCount, nonPublicCount }: { postCount: number; nonPublicCount: number }) {
  return (
    <nav className="pixel-panel mt-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center" aria-label="내 블로그 관리" data-owner-toolbar>
      <Link href="/write" className="pixel-btn min-h-12 shrink-0 bg-leaf px-6 text-white">
        <PixelIcon name="pencil" scale={2} />새 글 쓰기
      </Link>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-3.5 sm:flex sm:flex-wrap sm:items-center">
        <Link href="/settings/posts" className={tool}>
          <PixelIcon name="file" scale={1} />글 관리 <span className="pb-chip-muted px-1 font-sans text-xs">{postCount + nonPublicCount}</span>
        </Link>
        <Link href="/settings/blog#categories" className={tool}>
          <PixelIcon name="folder" scale={1} />카테고리 관리
        </Link>
        <Link href="/settings/blog" className={tool}>
          <PixelIcon name="gear" scale={1} />블로그 설정
        </Link>
        <Link href="/closet" className={tool}>
          <PixelIcon name="palette" scale={1} />꾸미기
        </Link>
      </div>
    </nav>
  );
}
