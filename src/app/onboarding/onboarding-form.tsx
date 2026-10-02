"use client";

import { useActionState } from "react";
import { CharacterArt } from "@/components/character";
import { completeOnboarding, type OnboardingState } from "./actions";

type Starter = { id: number; name: string; description: string | null; assetKey: string };

function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-bold">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-berry">{error}</span> : hint && <span className="mt-1 block text-sm text-ink-soft">{hint}</span>}
    </label>
  );
}

const inputClass = "w-full rounded-xl border-2 border-line bg-white px-3 py-2.5 outline-none focus:border-sun";

export function OnboardingForm({ starters, defaultNickname }: { starters: Starter[]; defaultNickname: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const v = state.values ?? {};

  return (
    <form action={action} className="card mt-6 space-y-6 p-6">
      <Field label="닉네임" error={state.errors?.nickname} hint="마을에서 불릴 이름 (2~12자)">
        <input name="nickname" defaultValue={v.nickname ?? defaultNickname} className={inputClass} maxLength={12} required />
      </Field>

      <Field label="블로그 이름" error={state.errors?.blogTitle}>
        <input name="blogTitle" defaultValue={v.blogTitle ?? ""} placeholder="예: 진행의 개발 일지" className={inputClass} maxLength={40} required />
      </Field>

      <Field label="블로그 주소" error={state.errors?.slug} hint="영문 소문자, 숫자, _ (3~20자)">
        <div className="flex items-center rounded-xl border-2 border-line bg-white focus-within:border-sun">
          <span className="pl-3 text-ink-soft">blogville/@</span>
          <input name="slug" defaultValue={v.slug ?? ""} placeholder="jinhaeng" className="w-full bg-transparent px-1 py-2.5 outline-none" maxLength={20} required />
        </div>
      </Field>

      <fieldset>
        <legend className="mb-1 font-bold">처음 함께할 캐릭터</legend>
        <p className="mb-2 text-sm text-ink-soft">셋 다 받아요. 나머지 둘은 꾸미기에서 언제든 바꿔 낄 수 있어요.</p>
        <div className="grid grid-cols-3 gap-3">
          {starters.map((c, i) => (
            <label key={c.id} className="cursor-pointer">
              <input
                type="radio"
                name="characterId"
                value={c.id}
                defaultChecked={v.characterId ? Number(v.characterId) === c.id : i === 0}
                className="peer sr-only"
              />
              <span className="flex flex-col items-center rounded-2xl border-2 border-line bg-white p-4 text-center transition peer-checked:border-sun peer-checked:bg-[#fff3d6] peer-checked:shadow-[0_4px_0_0_var(--color-sun-dark)] peer-focus-visible:ring-2 peer-focus-visible:ring-sky">
                <CharacterArt asset={c.assetKey} size={80} />
                <span className="mt-2 font-display text-lg">{c.name}</span>
                <span className="text-xs text-ink-soft">{c.description}</span>
              </span>
            </label>
          ))}
        </div>
        {state.errors?.characterId && <p className="mt-1 text-sm text-berry">{state.errors.characterId}</p>}
      </fieldset>

      <button type="submit" disabled={pending} className="btn w-full bg-leaf py-3 text-lg text-white">
        {pending ? "등록하는 중..." : "광장으로 출발! 🚀"}
      </button>
      <p className="text-center text-sm text-ink-soft">가입 축하 선물로 🪙 100 코인을 드려요</p>
    </form>
  );
}
