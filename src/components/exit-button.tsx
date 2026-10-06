"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 광장이 메인이라 다른 곳으로 가는 메뉴는 두지 않는다. 광장 밖에서는 "나가기"로 광장에 돌아온다.
const HIDDEN_ON = new Set(["/", "/town", "/onboarding"]);

export function ExitButton() {
  const pathname = usePathname();
  if (HIDDEN_ON.has(pathname)) return null;
  return (
    <Link href="/town" className="btn shrink-0 whitespace-nowrap bg-white py-1.5 text-sm text-ink max-sm:px-3">
      <span>← <span className="hidden sm:inline">광장으로 </span>나가기</span>
    </Link>
  );
}

/**
 * 헤더 로고. 좁은 화면에서 나가기 버튼이 보일 때는 숨긴다.
 * 둘 다 광장으로 가는데, 자리가 모자라 나가기 버튼이 코인과 겹쳐 보였다 (이슈 #5)
 */
export function HomeLogo({ href }: { href: string }) {
  const pathname = usePathname();
  const exitShown = !HIDDEN_ON.has(pathname);
  return (
    <Link href={href} className={`shrink-0 font-display text-xl text-leaf-dark sm:text-2xl ${exitShown ? "max-sm:hidden" : ""}`}>
      Blogville
    </Link>
  );
}
