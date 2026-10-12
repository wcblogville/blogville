"use client";

// 글 상세의 댓글·답글 영역 (SOC-01, SOC-02 / contracts/comments.md 3절)
// 권한(canReply·canDelete)은 서버가 계산해 넘긴다. 버튼을 숨기는 것은 표시용이고 실제 판단은 Server Action이 한다
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { addComment, addReply, deleteComment, deleteReply, type CommentState } from "@/app/blog/actions";
import { CharacterBadge } from "@/components/character";
import type { CommentAuthor, CommentThread, CommentView, ReplyView } from "@/server/social";
import { PixelIcon } from "@/components/pixel-icon";

// 누르는 영역 44px, 글자 한 줄, 키보드 선택 표시 (FR-004, FR-005)
const smallButton =
  "inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap px-2 font-display text-sm text-ink-soft hover:bg-[#fff3d6] hover:text-ink focus-visible:outline-2 focus-visible:outline-sun";

function Form({
  kind,
  postId,
  commentId,
  onDone,
  onCancel,
}: {
  kind: "comment" | "reply";
  postId: number;
  commentId?: number;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [state, action, pending] = useActionState<CommentState, FormData>(kind === "reply" ? addReply : addComment, {});
  // 성공하면 입력칸을 다시 그려 비운다. 실패하면 폼을 초기화하지 않아 쓴 내용이 그대로 남는다
  // (form action 대신 onSubmit에서 직접 불러 React 19의 자동 초기화를 피한다)
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(() => {
      setFormKey((k) => k + 1);
      onDone?.();
    });
    return () => clearTimeout(t);
  }, [state.ok, onDone]);
  const reply = kind === "reply";

  return (
    <form
      key={formKey}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-3 p-[3px]"
    >
      <input type="hidden" name="postId" value={postId} />
      {reply && <input type="hidden" name="commentId" value={commentId} />}
      <textarea
        name="content"
        maxLength={1000}
        rows={reply ? 2 : 3}
        aria-label={reply ? "답글" : "댓글"}
        placeholder={reply ? "답글을 남겨 주세요" : "따뜻한 댓글을 남겨 주세요"}
        className="pixel-input resize-y"
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error && (
          <span role="alert" className="text-sm text-berry">
            {state.error}
          </span>
        )}
        {reply && (
          <button type="button" onClick={onCancel} className={smallButton}>
            답글 취소
          </button>
        )}
        <button
          disabled={pending}
          className="pixel-btn pixel-btn-sm whitespace-nowrap bg-leaf px-4 text-white"
        >
          {pending ? "등록 중..." : reply ? "답글 등록" : "댓글 등록"}
        </button>
      </div>
    </form>
  );
}

function Line({
  author,
  createdAtText,
  deleted,
  content,
  children,
}: {
  author: CommentAuthor | null;
  createdAtText: string;
  deleted: boolean;
  content: string;
  children?: React.ReactNode;
}) {
  // 탈퇴 자리: 문구만 (캐릭터·닉네임·시각 없음)
  if (!author) return <p className="py-3 italic text-ink-soft">삭제된 댓글이에요</p>;
  return (
    <div className="flex gap-3 py-3">
      <span className="pixel-slot h-fit shrink-0 p-1">
        <CharacterBadge asset={author.characterAsset} outfit={author.outfit} size={34} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm">
          <Link href={`/@${author.blogSlug}`} className="inline-flex min-h-11 min-w-11 items-center font-bold hover:text-leaf-dark">
            {author.nickname}
          </Link>
          <span className="text-ink-soft">{createdAtText}</span>
        </p>
        <p className={`whitespace-pre-wrap break-words ${deleted ? "italic text-ink-soft" : ""}`}>{deleted ? "삭제된 댓글이에요" : content}</p>
        {children}
      </div>
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => Promise<void> }) {
  return (
    <button
      type="button"
      className={`${smallButton} hover:text-berry`}
      onClick={() => {
        if (confirm("댓글을 삭제할까요?")) startTransition(onDelete);
      }}
    >
      삭제
    </button>
  );
}

function ReplyLine({ r }: { r: ReplyView }) {
  return (
    <div id={`reply-${r.id}`} className="ml-6 border-l-2 border-[#d9b98a] pl-4 shadow-[inset_1px_0_0_0_#d9b98a] sm:ml-12">
      <Line author={r.author} createdAtText={r.createdAtText} deleted={r.deleted} content={r.content}>
        {r.canDelete && (
          <div className="flex gap-1">
            <DeleteButton onDelete={() => deleteReply(r.id)} />
          </div>
        )}
      </Line>
    </div>
  );
}

function CommentLine({ c, postId }: { c: CommentView; postId: number }) {
  const [replying, setReplying] = useState(false);
  return (
    <div id={`comment-${c.id}`}>
      <Line author={c.author} createdAtText={c.createdAtText} deleted={c.deleted} content={c.content}>
        {(c.canReply || c.canDelete) && (
          <div className="flex gap-1">
            {c.canReply && !replying && (
              <button type="button" onClick={() => setReplying(true)} className={smallButton}>
                답글
              </button>
            )}
            {c.canDelete && <DeleteButton onDelete={() => deleteComment(c.id)} />}
          </div>
        )}
        {replying && (
          <div className="mt-2">
            <Form kind="reply" postId={postId} commentId={c.id} onDone={() => setReplying(false)} onCancel={() => setReplying(false)} />
          </div>
        )}
      </Line>
      {c.replies.map((r) => (
        <ReplyLine key={r.id} r={r} />
      ))}
    </div>
  );
}

export function CommentSection({ postId, thread, isMember }: { postId: number; thread: CommentThread; isMember: boolean }) {
  return (
    <section id="comments" className="mt-10 scroll-mt-20" aria-label="댓글">
      <h2 className="pixel-wood mb-3 inline-flex items-center gap-2 px-3 pt-1 pb-1.5 font-display text-xl">
        <PixelIcon name="chat" scale={2} />댓글 {thread.count}
      </h2>
      <div className="divide-y-2 divide-dashed divide-[#e2c9a0]">
        {thread.comments.map((c) => (
          <CommentLine key={c.id} c={c} postId={postId} />
        ))}
      </div>
      <div className="mt-4">
        {isMember ? (
          <Form kind="comment" postId={postId} />
        ) : (
          <p className="pixel-slot p-4 text-center text-ink-soft">
            <Link href="/" className="inline-flex min-h-11 items-center font-bold text-leaf-dark underline">
              로그인
            </Link>
            하면 댓글을 남길 수 있어요
          </p>
        )}
      </div>
    </section>
  );
}
