"use client";

import { useOptimistic, useTransition } from "react";
import { toggleLike } from "@/app/blog/actions";

export function LikeButton({ postId, count, liked, canLike }: { postId: number; count: number; liked: boolean; canLike: boolean }) {
  const [pending, startTransition] = useTransition();
  // 서버 응답을 기다리지 않고 바로 하트를 바꿔 보여준다
  const [state, setState] = useOptimistic({ count, liked });

  return (
    <button
      type="button"
      disabled={!canLike || pending}
      title={canLike ? undefined : "로그인하면 공감할 수 있어요"}
      aria-pressed={state.liked}
      onClick={() =>
        startTransition(async () => {
          setState({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) });
          await toggleLike(postId);
        })
      }
      className={`btn border-2 px-6 text-lg ${state.liked ? "border-berry bg-[#ffecec] text-berry" : "border-line bg-white text-ink"}`}
    >
      {state.liked ? "♥" : "♡"} 공감 {state.count}
    </button>
  );
}
