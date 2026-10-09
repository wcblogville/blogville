"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// 광장이 메인이라 다른 곳으로 가는 메뉴는 두지 않는다. 광장 밖에서는 "나가기"로 광장에 돌아온다.
const HIDDEN_ON = new Set(["/", "/town"]);

export function ExitButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (HIDDEN_ON.has(pathname)) return null;
  // 가입 직후 블로그(?welcome=1)에서 나가면 문으로 나간 것과 같게 첫 마을 환영으로 간다
  const exit = (e: React.MouseEvent) => {
    if (!new URLSearchParams(window.location.search).has("welcome")) return;
    e.preventDefault();
    router.push("/town?welcome=1");
  };
  return (
    <Link href="/town" onClick={exit} className="btn min-h-11 shrink-0 whitespace-nowrap bg-white py-1.5 text-sm text-ink max-sm:px-3">
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
    <Link href={href} className={`shrink-0 font-display text-xl text-leaf-dark sm:text-2xl ${exitShown ? "max-sm:hidden" : ""} group-data-[town]:pointer-events-auto group-data-[town]:text-3xl group-data-[town]:text-white group-data-[town]:[text-shadow:0_2px_0_#2f6b2a,0_0_10px_rgba(0,0,0,.25)] group-data-[town]:phone:text-leaf-dark group-data-[town]:phone:[text-shadow:none]`}>
      Blogville
    </Link>
  );
}
