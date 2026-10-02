"use client";

import { useTransition } from "react";
import { adminDeletePost } from "./actions";

export function AdminDeletePostButton({ postId, title }: { postId: number; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm text-berry hover:underline disabled:opacity-50"
      onClick={() => confirm(`'${title}' 글을 삭제할까요?`) && start(() => adminDeletePost(postId))}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
