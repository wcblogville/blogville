"use client";

import { usePathname } from "next/navigation";
import { isTownPath } from "@/components/town/layout";

// 광장은 화면 전체를 쓰므로 푸터를 숨긴다
export function SiteFooter() {
  const pathname = usePathname();
  if (isTownPath(pathname)) return null;
  // 첫 화면은 잔디 아래 흙처럼 짙은 갈색 (도트 마을 풍경과 이어진다)
  const landing = pathname === "/";
  return (
    <footer
      className={`py-6 text-center text-sm ${landing ? "border-t-[6px] border-[#4a3426] bg-[#7a4a2e] text-[#f6e0b8]" : "border-t-2 border-line text-ink-soft"}`}
    >
      Blogville · AI응용프로젝트
    </footer>
  );
}
