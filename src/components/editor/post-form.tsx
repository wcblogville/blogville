"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { savePost, type SavePostState } from "@/app/write/actions";
import { readDraft, writeDraft, type Draft } from "@/lib/draft";
import { POST_REWARD_MIN_LENGTH, REWARD_RULES } from "@/lib/game";
import { checkPostInput, isContentTooLarge, rawPostInput, TAGS_MAX, TITLE_MAX } from "@/lib/post-rules";
import { RichEditor } from "./rich-editor";

export type CategoryOption = { id: number; name: string; subcategories: { id: number; name: string }[] };

export type PostFormValues = {
  postId?: number;
  title: string;
  contentHtml: string;
  categoryId: number | null;
  subcategoryId: number | null;
  tags: string[];
  visibility: "public" | "private";
};

/** 임시 저장 시각 `HH:mm` (한국 시간, FR-061) */
const savedTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/**
 * 글쓰기·수정 화면 (POST-01~04, POST-08 / contracts/write-actions.md §1).
 * draftOwnerId가 있으면(새 글 화면) 이 브라우저에 회원별로 임시 저장하고, 열 때 불러올지 묻는다 (FR-060~064)
 */
export function PostForm({ categories, initial, draftOwnerId }: { categories: CategoryOption[]; initial: PostFormValues; draftOwnerId?: string }) {
  // 임시 글을 불러올지 정하기 전에는 에디터를 그리지 않는다 (에디터는 처음 값으로 한 번 만들어진다)
  const [start, setStart] = useState<PostFormValues | null>(draftOwnerId ? null : initial);
  const asked = useRef(false);
  useEffect(() => {
    if (!draftOwnerId || asked.current) return;
    asked.current = true;
    // confirm 창은 그린 뒤에 띄운다 (빈 화면 위에 바로 뜨지 않게)
    const t = setTimeout(() => {
      const draft = readDraft(draftOwnerId);
      if (!draft || !window.confirm("작성 중이던 글이 있어요. 불러올까요?")) {
        setStart(initial);
        return;
      }
      // 그사이 지워진 대분류·소분류는 비운다 (FR-062)
      const cat = categories.find((c) => c.id === draft.categoryId);
      const sub = cat?.subcategories.find((s) => s.id === draft.subcategoryId);
      setStart({
        title: draft.title,
        contentHtml: draft.contentHtml,
        categoryId: cat?.id ?? null,
        subcategoryId: sub?.id ?? null,
        tags: draft.tags ? [draft.tags] : [],
        visibility: draft.visibility,
      });
    }, 0);
    return () => {
      clearTimeout(t);
      asked.current = false;
    };
  }, [draftOwnerId, categories, initial]);

  if (!start) return <div className="min-h-[600px]" aria-busy="true" />;
  return <Form categories={categories} initial={start} draftOwnerId={draftOwnerId} />;
}

function Form({ categories, initial, draftOwnerId }: { categories: CategoryOption[]; initial: PostFormValues; draftOwnerId?: string }) {
  const [state, action, pending] = useActionState<SavePostState, FormData>(savePost, {});
  const [title, setTitle] = useState(initial.title);
  const [categoryId, setCategoryId] = useState(initial.categoryId ? String(initial.categoryId) : "");
  const [subcategoryId, setSubcategoryId] = useState(initial.subcategoryId ? String(initial.subcategoryId) : "");
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [html, setHtml] = useState(initial.contentHtml);
  const [length, setLength] = useState(0);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [uploading, setUploading] = useState(false); // 첨부를 올리는 중에는 발행하지 않는다 (POST-07)
  const [clientError, setClientError] = useState<string | null>(null);
  const isNew = !initial.postId;
  const rewardable = isNew && visibility === "public" && length >= POST_REWARD_MIN_LENGTH;
  const subs = categories.find((c) => String(c.id) === categoryId)?.subcategories ?? [];
  const error = clientError ?? state.error;

  // ===== 임시 저장 (새 글만, FR-060·061·063) =====
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false); // 발행 버튼을 누른 뒤에는 다시 쓰지 않는다
  const changed = useRef(false); // 처음 그린 값(불러온 임시 글 포함)만으로는 쓰지 않는다
  const editorReady = useRef(false); // 에디터가 처음 만들어질 때 부르는 onChange는 "바뀜"이 아니다
  const latest = useRef<{ draft: Omit<Draft, "savedAt">; textEmpty: boolean } | null>(null);
  useEffect(() => {
    latest.current = {
      draft: {
        title,
        categoryId: categoryId ? Number(categoryId) : null,
        subcategoryId: subcategoryId ? Number(subcategoryId) : null,
        visibility,
        contentHtml: html,
        tags,
      },
      textEmpty: length === 0,
    };
  });

  const flushDraft = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const now = latest.current;
    if (!draftOwnerId || !changed.current || !now) return;
    // 제목(앞뒤 공백 제외)과 본문 글자가 모두 비면 쓰지 않는다
    if (!now.draft.title.trim() && now.textEmpty) return;
    const draft = { ...now.draft, savedAt: new Date().toISOString() };
    if (writeDraft(draftOwnerId, draft)) setSavedAt(draft.savedAt);
  };
  const flushRef = useRef(flushDraft);
  useEffect(() => {
    flushRef.current = flushDraft;
  });

  // 마지막 변경 2초 뒤 저장
  useEffect(() => {
    if (!draftOwnerId || stopped.current || !changed.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), 2000);
  }, [draftOwnerId, title, categoryId, subcategoryId, visibility, html, tags]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  // 발행에 실패하면 다시 임시 저장한다 (임시 글은 남아 있다, FR-063)
  useEffect(() => {
    if (state.error) stopped.current = false;
  }, [state]);

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      changed.current = true;
      setClientError(null);
      set(v);
    };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || uploading) return;
    const formData = new FormData(e.currentTarget);
    // 요청 본문 상한을 넘을 만큼 크면 보내지 않고 같은 규칙의 첫 문구를 보인다 (R11)
    if (isContentTooLarge(html)) {
      const checked = checkPostInput(rawPostInput(formData));
      setClientError("error" in checked ? checked.error : "글이 너무 길어요");
      return;
    }
    setClientError(null);
    if (draftOwnerId) {
      flushDraft();
      stopped.current = true;
    }
    // 폼 action 대신 직접 부른다: React의 폼 자동 초기화로 입력칸이 비지 않게 (FR-009)
    startTransition(() => action(formData));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {initial.postId && <input type="hidden" name="postId" value={initial.postId} />}
      <input type="hidden" name="contentHtml" value={html} />
      <input type="hidden" name="visibility" value={visibility} />

      <input
        name="title"
        value={title}
        onChange={(e) => edit(setTitle)(e.target.value)}
        placeholder="제목"
        maxLength={TITLE_MAX}
        className="w-full border-b-2 border-line bg-transparent px-1 py-3 font-display text-3xl outline-none focus:border-sun"
      />

      {/* 375px에서는 줄바꿈되어 가로 스크롤이 없다 (FR-066) */}
      <div className="flex flex-wrap gap-3">
        <select
          name="categoryId"
          value={categoryId}
          onChange={(e) => {
            // 대분류를 바꾸면 소분류를 푼다 (FR-031)
            edit(setCategoryId)(e.target.value);
            setSubcategoryId("");
          }}
          className="min-h-11 max-w-full rounded-xl border-2 border-line bg-white px-3 py-2"
          aria-label="대분류"
        >
          <option value="">카테고리 없음</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="subcategoryId"
          value={subcategoryId}
          onChange={(e) => edit(setSubcategoryId)(e.target.value)}
          disabled={!categoryId}
          className="min-h-11 max-w-full rounded-xl border-2 border-line bg-white px-3 py-2 disabled:opacity-50"
          aria-label="소분류"
        >
          <option value="">소분류 없음</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
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
              onClick={() => edit(setVisibility)(v)}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-bold ${visibility === v ? "bg-ink text-cream" : "text-ink-soft"}`}
            >
              {v === "public" ? "🌍 공개" : "🔒 비공개"}
            </button>
          ))}
        </div>
      </div>

      <RichEditor
        initialHtml={initial.contentHtml}
        postId={initial.postId}
        onChange={(h, n) => {
          if (editorReady.current) {
            changed.current = true;
            setClientError(null);
          }
          editorReady.current = true;
          setHtml(h);
          setLength(n);
        }}
        onUploadingChange={setUploading}
      />

      <input
        name="tags"
        value={tags}
        onChange={(e) => edit(setTags)(e.target.value)}
        placeholder="태그 (쉼표로 구분, 최대 10개)  예: git, 회고"
        className="w-full rounded-xl border-2 border-line bg-white px-3 py-2.5"
        aria-label="태그"
        maxLength={TAGS_MAX}
      />

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-ink-soft">
          <p>
            {length.toLocaleString("ko-KR")}자 ·{" "}
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
          {draftOwnerId && (
            <p className="mt-1 text-xs" data-draft-status>
              {savedAt ? `임시 저장됨 ${savedTime(savedAt)}` : "작성 중인 글은 이 브라우저에 자동 저장됩니다."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm font-bold text-berry">{error}</span>}
          <button type="submit" disabled={pending || uploading} className="btn bg-leaf text-white">
            {uploading ? "첨부를 올리는 중..." : pending ? "저장하는 중..." : isNew ? "발행하기" : "수정 완료"}
          </button>
        </div>
      </div>
    </form>
  );
}
