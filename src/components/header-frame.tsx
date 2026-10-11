"use client";

import { usePathname } from "next/navigation";
import { isTownPath } from "@/components/town/layout";

/**
 * 헤더 틀. 첫 화면(`/`)에서는 그리지 않는다. 마을(/town, 다른 회원의 마을 /town/주소)에서는 막대(레벨·코인·알림·로그아웃)를 숨기고 "Blogville" 글자만 화면 위에 띄운다.
 * 그 기능은 마을의 ☰ 메뉴에 다 있다 (사용자 요청 2026-10-08). 숨길 칸은 `group-data-[town]:hidden`으로 표시한다
 */
export function HeaderFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const town = isTownPath(pathname);
  // 첫 화면(로그인·회원가입)은 도트 마을 풍경과 큰 Blogville 제목이 화면 맨 위부터 채우므로 헤더 막대를 그리지 않는다 (2026-10-11).
  // 로그인한 회원은 첫 화면에 오면 /town으로 옮겨지므로 감출 회원 기능이 없다
  if (pathname === "/") return null;
  return (
    <header
      data-town={town ? "" : undefined}
      className={
        town
          ? "group pointer-events-none fixed inset-x-0 top-0 z-30"
          : "group sticky top-0 z-20 border-b-2 border-line bg-cream/95 backdrop-blur"
      }
    >
      {children}
    </header>
  );
}
