"use client";

import { deletePost } from "@/app/write/actions";

/** back="manage": 글 관리 화면에서 지우면 그 화면으로 돌아온다 */
export function DeletePostButton({ postId, back }: { postId: number; back?: "manage" }) {
  return (
    <button
      type="button"
      // 누르는 영역 44×44px (R21)
      className="pixel-btn pixel-btn-sm min-w-11 whitespace-nowrap bg-[#fffaf0] px-3 text-berry"
      onClick={() => confirm("이 글을 삭제할까요? 댓글과 공감도 함께 지워져요.") && deletePost(postId, back)}
    >
      삭제
    </button>
  );
}
