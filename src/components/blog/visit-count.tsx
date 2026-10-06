"use client";

import { useEffect, useState, useTransition } from "react";
import { recordBlogVisit } from "@/app/blog/actions";

type Stats = { today: number; total: number };
const n = (v: number) => v.toLocaleString("ko-KR");

/**
 * 블로그 상단의 `오늘 방문 N · 전체 방문 N` (BLOG-06).
 * 서버가 그린 숫자로 시작하고, 화면이 열리면 방문을 기록한 뒤 돌려받은 숫자로 바꾼다. 주인이면 기록하지 않는다
 */
export function VisitCount({ blogId, initial, isOwner }: { blogId: number; initial: Stats; isOwner: boolean }) {
  const [stats, setStats] = useState(initial);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (isOwner) return;
    startTransition(async () => {
      const next = await recordBlogVisit(blogId).catch(() => null);
      if (next) setStats(next);
    });
    // 쿠키를 새로 만든 첫 방문에는 화면이 한 번 더 그려지므로 blogId가 바뀔 때만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogId]);

  return (
    <>
      오늘 방문 {n(stats.today)} · 전체 방문 {n(stats.total)}
    </>
  );
}
