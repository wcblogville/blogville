"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addCategory, deleteCategory, moveCategory, renameCategory, updateBlogInfo, type FormState } from "./actions";

const input = "w-full rounded-xl border-2 border-line bg-white px-3 py-2 outline-none focus:border-sun";

export function BlogInfoForm({ title, description }: { title: string; description: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBlogInfo, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block font-bold">블로그 이름</span>
        <input name="title" defaultValue={title} maxLength={40} required className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block font-bold">소개</span>
        <textarea name="description" defaultValue={description} maxLength={160} rows={2} className={input} placeholder="어떤 이야기를 쓰는 블로그인가요?" />
      </label>
      <div className="flex items-center justify-end gap-3">
        {state.error && <span className="text-sm text-berry">{state.error}</span>}
        {state.ok && !state.error && <span className="text-sm text-leaf-dark">저장했어요 ✓</span>}
        <button disabled={pending} className="btn bg-leaf text-white">저장</button>
      </div>
    </form>
  );
}

type Category = { id: number; name: string; postCount: number };

function CategoryRow({ c, first, last }: { c: Category; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <div className="flex flex-col">
        <button type="button" disabled={first || pending} onClick={() => start(() => moveCategory(c.id, -1))} className="px-1 text-xs disabled:opacity-30" aria-label={`${c.name} 위로`}>▲</button>
        <button type="button" disabled={last || pending} onClick={() => start(() => moveCategory(c.id, 1))} className="px-1 text-xs disabled:opacity-30" aria-label={`${c.name} 아래로`}>▼</button>
      </div>
      {editing ? (
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className={`${input} w-auto flex-1 py-1`} aria-label="카테고리 이름" autoFocus />
      ) : (
        <span className="flex-1">
          {c.name} <span className="text-sm text-ink-soft">({c.postCount})</span>
        </span>
      )}
      {editing ? (
        <>
          <button
            type="button"
            disabled={pending}
            className="text-sm font-bold text-leaf-dark"
            onClick={() =>
              start(async () => {
                const r = await renameCategory(c.id, name);
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
          <button type="button" className="text-sm text-ink-soft" onClick={() => { setEditing(false); setName(c.name); setError(""); }}>
            취소
          </button>
        </>
      ) : (
        <>
          <button type="button" className="text-sm text-ink-soft hover:text-ink" onClick={() => setEditing(true)}>이름 바꾸기</button>
          <button
            type="button"
            disabled={pending}
            className="text-sm text-ink-soft hover:text-berry"
            onClick={() => confirm(`'${c.name}' 카테고리를 지울까요? 글은 남고 '카테고리 없음'이 돼요.`) && start(() => deleteCategory(c.id))}
          >
            삭제
          </button>
        </>
      )}
      {error && <span className="w-full text-sm text-berry">{error}</span>}
    </li>
  );
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCategory, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <div>
      <ul className="divide-y-2 divide-line/60">
        {categories.map((c, i) => (
          <CategoryRow key={c.id} c={c} first={i === 0} last={i === categories.length - 1} />
        ))}
      </ul>
      <form ref={ref} action={action} className="mt-3 flex gap-2">
        <input name="name" maxLength={20} placeholder="새 카테고리" required className={input} aria-label="새 카테고리 이름" />
        <button disabled={pending} className="btn shrink-0 bg-ink text-cream">추가</button>
      </form>
      {state.error && <p className="mt-1 text-sm text-berry">{state.error}</p>}
    </div>
  );
}
