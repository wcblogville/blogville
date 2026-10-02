"use client";

import { deletePost } from "@/app/write/actions";

export function DeletePostButton({ postId }: { postId: number }) {
  return (
    <button
      type="button"
      className="text-sm text-ink-soft hover:text-berry"
      onClick={() => confirm("이 글을 삭제할까요? 댓글과 공감도 함께 지워져요.") && deletePost(postId)}
    >
      삭제
    </button>
  );
}
