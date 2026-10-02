"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 광장이 메인이라 다른 곳으로 가는 메뉴는 두지 않는다. 광장 밖에서는 "나가기"로 광장에 돌아온다.
const HIDDEN_ON = new Set(["/", "/town", "/onboarding"]);

export function ExitButton() {
  const pathname = usePathname();
  if (HIDDEN_ON.has(pathname)) return null;
  return (
    <Link href="/town" className="btn shrink-0 bg-white py-1.5 text-sm text-ink">
      ← <span className="hidden sm:inline">광장으로&nbsp;</span>나가기
    </Link>
  );
}
