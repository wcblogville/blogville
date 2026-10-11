"use client";

import { useEffect, useState } from "react";

type Stats = { today: number; yesterday: number; total: number };
const n = (v: number) => v.toLocaleString("ko-KR");

/**
 * 옆 칸 방문자 위젯 숫자 (BLOG-06). 방문 기록은 프로필 카드의 VisitCount가 한 번만 하고,
 * 돌려받은 숫자를 bv-blog-visits 이벤트로 알려 주면 여기도 같은 숫자로 바꾼다 (두 번 기록하지 않게)
 */
export function VisitWidget({ blogId, initial }: { blogId: number; initial: Stats }) {
  const [stats, setStats] = useState(initial);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Stats & { blogId: number }>).detail;
      if (d?.blogId === blogId) setStats({ today: d.today, yesterday: d.yesterday, total: d.total });
    };
    window.addEventListener("bv-blog-visits", on);
    return () => window.removeEventListener("bv-blog-visits", on);
  }, [blogId]);

  return (
    <dl className="grid grid-cols-3 gap-2 text-center" data-visit-widget>
      {[
        ["오늘", stats.today],
        ["어제", stats.yesterday],
        ["전체", stats.total],
      ].map(([label, value]) => (
        <div key={label} className={`rounded-xl px-1 py-2 ${label === "오늘" ? "bg-[#fff3d6]" : "bg-cream"}`}>
          <dt className="text-xs text-ink-soft">{label}</dt>
          <dd className="font-display text-xl" data-visit={label}>
            {n(value as number)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
