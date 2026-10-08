"use client";

import { useEffect, useState } from "react";
import { recordPostView } from "@/app/blog/[slug]/[postId]/actions";

/**
 * 글 조회수 `👀 N` (POST-06 / FR-046, research R2). 처음 값은 서버가 정한다(오늘 이 브라우저로 처음이면 저장값 + 1).
 * 주인이 아니면 화면이 처음 열릴 때 한 번만 기록하고 돌려받은 값으로 바꾼다. 공감·댓글 뒤 다시 그려도 다시 부르지 않는다
 */
export function ViewCount({ postId, initial, count }: { postId: number; initial: number; count: boolean }) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (!count) return;
    recordPostView(postId)
      .then((r) => r && setValue(r.viewCount))
      .catch(() => {});
  }, [postId, count]);
  return <span>👀 {value}</span>;
}
