"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { todayKST } from "@/lib/game";

/**
 * 화면을 연 채 한국 시간 0시를 넘긴 경우 (GAME-04 Edge Cases): 주소 이동·탭 다시 보기 때 날짜가 바뀌었으면
 * router.refresh()로 서버를 다시 그려 자동 출석과 헤더 숫자를 갱신한다. 화면에는 아무것도 그리지 않는다.
 */
export function AttendanceDayWatcher({ today }: { today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const seen = useRef(today);

  useEffect(() => {
    seen.current = today;
  }, [today]);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const now = todayKST();
      if (now !== seen.current) {
        seen.current = now;
        router.refresh();
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [pathname, router]);

  return null;
}
