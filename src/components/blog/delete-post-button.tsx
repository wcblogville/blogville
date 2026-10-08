"use client";

import { deletePost } from "@/app/write/actions";

export function DeletePostButton({ postId }: { postId: number }) {
  return (
    <button
      type="button"
      // 누르는 영역 44×44px (R21)
      className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap text-sm text-ink-soft hover:text-berry"
      onClick={() => confirm("이 글을 삭제할까요? 댓글과 공감도 함께 지워져요.") && deletePost(postId)}
    >
      삭제
    </button>
  );
}
