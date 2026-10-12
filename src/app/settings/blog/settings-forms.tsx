"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addCategory,
  addSubcategory,
  deleteCategory,
  deleteSubcategory,
  moveCategory,
  moveSubcategory,
  renameCategory,
  renameSubcategory,
  updateBlogInfo,
  updateBlogSlug,
  type FormState,
} from "./actions";

// 도트 입력 칸 (globals.css pixel-input). 테두리가 바깥 3px에 그려져 감싼 폼에 p-[3px]을 둔다
const input = "pixel-input";

/** 폼 결과 한 줄: 버튼 왼쪽에 빨간 오류 또는 초록 성공 (FR-016·017) */
function FormResult({ state, id }: { state: FormState; id: string }) {
  if (state.error)
    return (
      <span id={id} role="alert" className="text-sm font-bold text-berry">
        {state.error}
      </span>
    );
  if (state.ok)
    return (
      <span role="status" className="text-sm text-leaf-dark">
        저장했어요 ✓
      </span>
    );
  return null;
}

/** 이름·소개 (BLOG-03 / FR-016·017). 오류가 나도 보낸 값이 칸에 남는다 (research R-08) */
export function BlogInfoForm({ title, description }: { title: string; description: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBlogInfo, {});
  const invalid = state.error ? { "aria-invalid": true, "aria-describedby": "blog-info-error" } : {};
  return (
    <form action={action} className="space-y-4 px-[3px]">
      <div>
        <label className="block">
          <span className="mb-2 block font-bold">블로그 이름</span>
          <input name="title" defaultValue={state.values?.title ?? title} maxLength={40} required placeholder="예: 나의 작은 왕국" className={input} {...invalid} />
        </label>
        {/* 2026-10-12 사용자 요청: 이름 전체를 자유롭게 (뒤에 `의 블로그`를 붙이지 않는다) */}
        <p className="mt-2 text-xs text-ink-soft" data-blog-title-hint>
          적은 이름 그대로 블로그 맨 위와 마을에 보여요 (40자까지)
        </p>
      </div>
      <label className="block">
        <span className="mb-2 block font-bold">소개</span>
        <textarea
          name="description"
          defaultValue={state.values?.description ?? description}
          maxLength={160}
          rows={2}
          className={input}
          placeholder="어떤 이야기를 쓰는 블로그인가요?"
          {...invalid}
        />
      </label>
      <div className="flex items-center justify-end gap-3">
        <FormResult state={state} id="blog-info-error" />
        <button disabled={pending} className="pixel-btn pixel-btn-sm min-w-11 shrink-0 whitespace-nowrap bg-leaf px-4 text-white">
          저장
        </button>
      </div>
    </form>
  );
}

/**
 * 블로그 주소 (BLOG-03 / FR-009·018, contracts/blog-home.md 3절, research R-09).
 * 이름·소개와 따로 저장한다. 라벨 `블로그 주소`·버튼 `주소 바꾸기`는 plan 임시 문구.
 * 성공하면 칸은 서버가 정규화한 값(My_Blog → my_blog), 오류면 보낸 값.
 */
export function BlogSlugForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBlogSlug, {});
  return (
    <form action={action} className="mt-6 space-y-3 px-[3px]">
      <div className="pb-dash mb-5" aria-hidden />
      <label htmlFor="blog-slug" className="block font-bold">
        블로그 주소
      </label>
      <div className="flex items-center gap-2">
        <span className="font-bold text-ink-soft">/@</span>
        <input
          id="blog-slug"
          name="slug"
          defaultValue={state.values?.slug ?? slug}
          maxLength={20}
          required
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className={input}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "blog-slug-error" : undefined}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <FormResult state={state} id="blog-slug-error" />
        <button disabled={pending} className="pixel-btn pixel-btn-sm min-w-11 shrink-0 whitespace-nowrap bg-ink px-4 text-cream">
          주소 바꾸기
        </button>
      </div>
    </form>
  );
}

type Sub = { id: number; name: string; postCount: number | null };
type Category = { id: number; name: string; postCount: number; subcategories: Sub[] };

const small = "inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap px-2 text-sm hover:bg-[#fff3d6]";

/**
 * 카테고리 한 줄 (대분류·소분류 같은 모양, BLOG-05 / FR-033~039, research R-24):
 * ▲▼(가로, 각 44×44px) · 이름 · (글 수) · [이름 바꾸기] [삭제]. 오류는 그 줄 아래 빨간 한 줄, 고친 이름은 칸에 남는다.
 */
function Row({
  name: current,
  postCount,
  first,
  last,
  label,
  confirmText,
  onMove,
  onRename,
  onDelete,
  children,
}: {
  name: string;
  postCount: number | null;
  first: boolean;
  last: boolean;
  label: string;
  confirmText: string;
  onMove: (d: -1 | 1) => Promise<void>;
  onRename: (name: string) => Promise<FormState>;
  onDelete: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(current);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-1 py-1">
      <div className="flex">
        <button type="button" disabled={first || pending} onClick={() => start(() => onMove(-1))} className={`${small} disabled:opacity-30`} aria-label={`${current} 위로`}>▲</button>
        <button type="button" disabled={last || pending} onClick={() => start(() => onMove(1))} className={`${small} disabled:opacity-30`} aria-label={`${current} 아래로`}>▼</button>
      </div>
      {editing ? (
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className={`${input} mx-[3px] w-auto min-w-24 flex-1 py-1`} aria-label={label} autoFocus />
      ) : (
        // 이름 칸은 6rem보다 좁아지지 않는다. 좁은 휴대폰에서 이름이 "일/상"처럼 한 글자씩 쪼개지던 것을 막고 버튼 묶음이 다음 줄로 간다
        <span className="min-w-24 flex-1 break-words">
          {current} {postCount !== null && <span className="text-sm text-ink-soft">({postCount})</span>}
        </span>
      )}
      {editing ? (
        <div className="ml-auto flex shrink-0 items-center">
          <button
            type="button"
            disabled={pending}
            className={`${small} font-bold text-leaf-dark`}
            onClick={() =>
              start(async () => {
                const r = await onRename(name);
                if (r.error) setError(r.error);
                else {
                  setError("");
                  setEditing(false);
                }
              })
            }
          >
            저장
          </button>
          <button type="button" className={`${small} text-ink-soft`} onClick={() => { setEditing(false); setName(current); setError(""); }}>
            취소
          </button>
        </div>
      ) : (
        <div className="ml-auto flex shrink-0 items-center">
          {children}
          <button type="button" className={`${small} text-ink-soft hover:text-ink`} onClick={() => setEditing(true)}>이름 바꾸기</button>
          <button
            type="button"
            disabled={pending}
            className={`${small} text-ink-soft hover:text-berry`}
            onClick={() => confirm(confirmText) && start(() => onDelete())}
          >
            삭제
          </button>
        </div>
      )}
      {error && <p role="alert" className="w-full text-sm text-berry">{error}</p>}
    </div>
  );
}

/** 이름 하나를 받는 추가 폼 (대분류·소분류). 성공하면 칸을 비우고, 오류면 보낸 값을 남긴다 (US5-1·3) */
function AddForm({ action: serverAction, placeholder, label, autoFocus = false }: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(serverAction, {});
  return (
    <div>
      {/* React가 처리 뒤 폼을 초기화하면 칸은 defaultValue로 돌아간다: 성공이면 빈 칸, 오류면 보낸 값 */}
      <form action={action} className="flex gap-3 px-[3px]">
        <input
          name="name"
          maxLength={20}
          placeholder={placeholder}
          required
          defaultValue={state.error ? (state.values?.name ?? "") : ""}
          className={input}
          aria-label={label}
          aria-invalid={state.error ? true : undefined}
          autoFocus={autoFocus}
        />
        <button disabled={pending} className="pixel-btn pixel-btn-sm min-w-11 shrink-0 whitespace-nowrap bg-ink px-4 text-cream">추가</button>
      </form>
      {state.error && <p role="alert" className="mt-1 text-sm text-berry">{state.error}</p>}
    </div>
  );
}

/** 대분류 줄 + 그 아래 들여 쓴 소분류 줄들 + [소분류 추가] (FR-034) */
function CategoryBlock({ c, first, last }: { c: Category; first: boolean; last: boolean }) {
  const [adding, setAdding] = useState(false);
  return (
    <li className="py-1">
      <Row
        name={c.name}
        postCount={c.postCount}
        first={first}
        last={last}
        label="카테고리 이름"
        confirmText={`'${c.name}' 카테고리를 지울까요? 글은 남고 '카테고리 없음'이 돼요.`}
        onMove={(d) => moveCategory(c.id, d)}
        onRename={(name) => renameCategory(c.id, name)}
        onDelete={() => deleteCategory(c.id)}
      >
        <button type="button" className={`${small} text-leaf-dark`} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
          소분류 추가
        </button>
      </Row>
      {(c.subcategories.length > 0 || adding) && (
        <ul className="ml-6 border-l-[3px] border-dotted border-[#d9b98a] pl-2">
          {c.subcategories.map((s, i) => (
            <li key={s.id}>
              <Row
                name={s.name}
                postCount={s.postCount}
                first={i === 0}
                last={i === c.subcategories.length - 1}
                label="소분류 이름"
                confirmText={`'${s.name}' 소분류를 지울까요? 글은 '${c.name}'에 남아요.`}
                onMove={(d) => moveSubcategory(s.id, d)}
                onRename={(name) => renameSubcategory(s.id, name)}
                onDelete={() => deleteSubcategory(s.id)}
              />
            </li>
          ))}
          {adding && (
            <li className="py-1">
              <AddForm action={addSubcategory.bind(null, c.id)} placeholder="새 소분류" label="새 소분류 이름" autoFocus />
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

/** 카테고리 관리: 대분류·소분류 2단계 트리 (BLOG-05 / FR-033~039). 글 수는 비공개 포함 */
export function CategoryManager({ categories }: { categories: Category[] }) {
  return (
    <div>
      <ul className="divide-y-2 divide-dashed divide-[#e2c9a0]">
        {categories.map((c, i) => (
          <CategoryBlock key={c.id} c={c} first={i === 0} last={i === categories.length - 1} />
        ))}
      </ul>
      <div className="mt-4">
        <AddForm action={addCategory} placeholder="새 카테고리" label="새 카테고리 이름" />
      </div>
    </div>
  );
}
