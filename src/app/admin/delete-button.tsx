"use client";

import { useTransition } from "react";
import { adminDeletePost } from "./actions";

/** 관리자 글 삭제 버튼. 누르는 영역 44×44px, 글자 한 줄 (FR-047, FR-054) */
export function AdminDeletePostButton({ postId, title }: { postId: number; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-2 text-sm text-berry hover:underline focus-visible:outline-2 focus-visible:outline-sky disabled:opacity-50"
      onClick={() => confirm(`'${title}' 글을 삭제할까요?`) && start(() => adminDeletePost(postId))}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
