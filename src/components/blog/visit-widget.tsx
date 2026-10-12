"use client";

import { useEffect, useState, useTransition } from "react";
import { recordBlogVisit } from "@/app/blog/actions";

type Stats = { today: number; yesterday: number; total: number };
const n = (v: number) => v.toLocaleString("ko-KR");

/**
 * 옆 칸 방문자 위젯 숫자 (BLOG-06). 블로그 홈의 방문 숫자는 여기 한 곳이다 (프로필 카드를 없앰, 2026-10-11).
 * 서버가 그린 숫자로 시작하고, 화면이 열리면 방문을 한 번 기록한 뒤 돌려받은 숫자로 바꾼다. 주인이면 기록하지 않는다.
 * 같은 숫자를 다른 곳에서도 보여 주려면 bv-blog-visits 이벤트를 들으면 된다 (두 번 기록하지 않게)
 */
export function VisitWidget({ blogId, initial, isOwner }: { blogId: number; initial: Stats; isOwner: boolean }) {
  const [stats, setStats] = useState(initial);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (isOwner) return;
    startTransition(async () => {
      const next = await recordBlogVisit(blogId).catch(() => null);
      if (next) window.dispatchEvent(new CustomEvent("bv-blog-visits", { detail: { blogId, ...next } }));
    });
    // 쿠키를 새로 만든 첫 방문에는 화면이 한 번 더 그려지므로 blogId가 바뀔 때만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogId]);

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
        <div key={label} className={`px-1 pt-2 pb-2.5 ${label === "오늘" ? "bg-[#ffe7a3] shadow-[inset_0_0_0_3px_#d99a36]" : "pixel-slot"}`}>
          <dt className="text-xs text-ink-soft">{label}</dt>
          <dd className="font-display text-xl" data-visit={label}>
            {n(value as number)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
