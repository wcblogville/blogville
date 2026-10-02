"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { addComment, deleteComment, type CommentState } from "@/app/blog/actions";
import { CharacterBadge } from "@/components/character";

export type CommentData = {
  id: number;
  parentId: number | null;
  content: string;
  createdAtText: string;
  deleted: boolean;
  authorId: string;
  nickname: string;
  characterAsset: string;
  blogSlug: string;
};

function CommentForm({ postId, parentId, onDone }: { postId: number; parentId?: number; onDone?: () => void }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(addComment, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      onDone?.();
    }
  }, [state.ok, onDone]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="postId" value={postId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        name="content"
        required
        maxLength={1000}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? "답글을 남겨 주세요" : "따뜻한 댓글을 남겨 주세요 💬"}
        className="w-full resize-y rounded-xl border-2 border-line bg-white px-3 py-2 outline-none focus:border-sun"
      />
      <div className="flex items-center justify-end gap-3">
        {state.error && <span className="text-sm text-berry">{state.error}</span>}
        <button disabled={pending} className="btn bg-ink py-1.5 text-sm text-cream">
          {pending ? "등록 중..." : parentId ? "답글 등록" : "댓글 등록"}
        </button>
      </div>
    </form>
  );
}

function CommentItem({ c, viewerId, postId, isReply }: { c: CommentData; viewerId: string | null; postId: number; isReply: boolean }) {
  const [replying, setReplying] = useState(false);
  return (
    <div className={isReply ? "ml-10 border-l-2 border-line pl-4" : ""}>
      <div className="flex gap-3 py-3">
        <CharacterBadge asset={c.characterAsset} size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Link href={`/@${c.blogSlug}`} className="font-bold hover:text-leaf-dark">
              {c.nickname}
            </Link>{" "}
            <span className="text-ink-soft">{c.createdAtText}</span>
          </p>
          <p className={`mt-0.5 whitespace-pre-wrap break-words ${c.deleted ? "italic text-ink-soft" : ""}`}>
            {c.deleted ? "삭제된 댓글이에요" : c.content}
          </p>
          {!c.deleted && viewerId && (
            <div className="mt-1 flex gap-3 text-xs text-ink-soft">
              {!isReply && (
                <button type="button" onClick={() => setReplying((v) => !v)} className="hover:text-ink">
                  {replying ? "답글 취소" : "답글"}
                </button>
              )}
              {c.authorId === viewerId && (
                <button
                  type="button"
                  className="hover:text-berry"
                  onClick={() => confirm("댓글을 삭제할까요?") && deleteComment(c.id)}
                >
                  삭제
                </button>
              )}
            </div>
          )}
          {replying && (
            <div className="mt-2">
              <CommentForm postId={postId} parentId={c.id} onDone={() => setReplying(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentSection({ postId, comments, viewerId }: { postId: number; comments: CommentData[]; viewerId: string | null }) {
  const roots = comments.filter((c) => !c.parentId);
  const replies = (id: number) => comments.filter((c) => c.parentId === id);
  const visibleCount = comments.filter((c) => !c.deleted).length;

  return (
    <section className="mt-10" aria-label="댓글">
      <h2 className="mb-2 font-display text-xl">💬 댓글 {visibleCount}</h2>
      <div className="divide-y-2 divide-line/60">
        {roots.map((c) => (
          <div key={c.id}>
            <CommentItem c={c} viewerId={viewerId} postId={postId} isReply={false} />
            {replies(c.id).map((r) => (
              <CommentItem key={r.id} c={r} viewerId={viewerId} postId={postId} isReply />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4">
        {viewerId ? (
          <CommentForm postId={postId} />
        ) : (
          <p className="rounded-xl bg-white p-4 text-center text-ink-soft">
            <Link href="/" className="font-bold text-leaf-dark underline">로그인</Link>하면 댓글을 남길 수 있어요
          </p>
        )}
      </div>
    </section>
  );
}
