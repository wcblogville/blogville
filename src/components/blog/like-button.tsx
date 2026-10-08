"use client";

// 공감 버튼 (SOC-03 / FR-026~FR-030)
import { useOptimistic, useTransition } from "react";
import { toggleLike } from "@/app/blog/actions";

export function LikeButton({ postId, count, liked, canLike }: { postId: number; count: number; liked: boolean; canLike: boolean }) {
  const [pending, startTransition] = useTransition();
  // 서버 응답을 기다리지 않고 바로 하트를 바꿔 보여준다
  const [state, setState] = useOptimistic({ count, liked });
  const hintId = `like-hint-${postId}`;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={!canLike || pending}
        aria-pressed={state.liked}
        aria-describedby={canLike ? undefined : hintId}
        onClick={() =>
          startTransition(async () => {
            setState({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) });
            await toggleLike(postId);
          })
        }
        className={`btn min-h-11 border-2 px-6 text-lg ${state.liked ? "border-berry bg-[#ffecec] text-berry" : "border-line bg-white text-ink"}`}
      >
        {state.liked ? "♥" : "♡"} 공감 {state.count}
      </button>
      {/* 비활성 버튼은 마우스를 올려도 title이 안 보여서(pointer-events: none) 글자로 보여 준다 (research R14) */}
      {!canLike && (
        <p id={hintId} className="text-sm text-ink-soft">
          로그인하면 공감할 수 있어요
        </p>
      )}
    </div>
  );
}
