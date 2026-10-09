"use client";

import { useEffect } from "react";

/**
 * 주소창에서 ?name=… 하나를 지운다. 화면은 다시 그리지 않는다(Next.js가 history.replaceState를 라우터와 맞춘다).
 * 한 번만 보여 줄 안내(마을 환영)가 새로고침하면 다시 뜨지 않게 한다
 */
export function DropSearchParam({ name }: { name: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [name]);
  return null;
}
