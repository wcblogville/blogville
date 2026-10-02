"use client";

import { useActionState, useState } from "react";
import { savePost, type SavePostState } from "@/app/write/actions";
import { POST_REWARD_MIN_LENGTH, REWARD_RULES } from "@/lib/game";
import { RichEditor } from "./rich-editor";

type Category = { id: number; name: string };

export type PostFormValues = {
  postId?: number;
  title: string;
  contentHtml: string;
  categoryId: number | null;
  tags: string[];
  visibility: "public" | "private";
};

export function PostForm({ categories, initial }: { categories: Category[]; initial: PostFormValues }) {
  const [state, action, pending] = useActionState<SavePostState, FormData>(savePost, {});
  const [html, setHtml] = useState(initial.contentHtml);
  const [length, setLength] = useState(0);
  const [visibility, setVisibility] = useState(initial.visibility);
  const isNew = !initial.postId;
  const rewardable = isNew && visibility === "public" && length >= POST_REWARD_MIN_LENGTH;

  return (
    <form action={action} className="space-y-4">
      {initial.postId && <input type="hidden" name="postId" value={initial.postId} />}
      <input type="hidden" name="contentHtml" value={html} />
      <input type="hidden" name="visibility" value={visibility} />

      <input
        name="title"
        defaultValue={initial.title}
        placeholder="제목"
        maxLength={100}
        required
        className="w-full border-b-2 border-line bg-transparent px-1 py-3 font-display text-3xl outline-none focus:border-sun"
      />

      <div className="flex flex-wrap gap-3">
        <select
          name="categoryId"
          defaultValue={initial.categoryId ?? ""}
          className="rounded-xl border-2 border-line bg-white px-3 py-2"
          aria-label="카테고리"
        >
          <option value="">카테고리 없음</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex rounded-xl border-2 border-line bg-white p-0.5" role="radiogroup" aria-label="공개 설정">
          {(["public", "private"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visibility === v}
              onClick={() => setVisibility(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${visibility === v ? "bg-ink text-cream" : "text-ink-soft"}`}
            >
              {v === "public" ? "🌍 공개" : "🔒 비공개"}
            </button>
          ))}
        </div>
      </div>

      <RichEditor
        initialHtml={initial.contentHtml}
        onChange={(h, n) => {
          setHtml(h);
          setLength(n);
        }}
      />

      <input
        name="tags"
        defaultValue={initial.tags.join(", ")}
        placeholder="태그 (쉼표로 구분, 최대 10개)  예: git, 회고"
        className="w-full rounded-xl border-2 border-line bg-white px-3 py-2.5"
        aria-label="태그"
        maxLength={300}
      />

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-ink-soft">
          {length.toLocaleString()}자 ·{" "}
          {isNew ? (
            rewardable ? (
              <span className="font-bold text-leaf-dark">
                저장하면 ✨ 경험치 {REWARD_RULES.post.exp} · 🪙 {REWARD_RULES.post.coins} 보상 (하루 {REWARD_RULES.post.dailyLimit}번까지)
              </span>
            ) : visibility === "private" ? (
              "비공개 글은 보상이 없어요"
            ) : (
              `${POST_REWARD_MIN_LENGTH}자 이상 쓰면 보상을 받아요`
            )
          ) : (
            "글을 고치고 있어요"
          )}
        </p>
        <div className="flex items-center gap-3">
          {state.error && <span className="text-sm font-bold text-berry">{state.error}</span>}
          <button type="submit" disabled={pending} className="btn bg-leaf text-white">
            {pending ? "저장하는 중..." : isNew ? "발행하기" : "수정 완료"}
          </button>
        </div>
      </div>
    </form>
  );
}
