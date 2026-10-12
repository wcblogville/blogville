"use client";

// 내 프로필의 "마을 한마디" 바로 고치기 (사용자 요청 2026-10-12 "친구들한테 보일 인사말 작성하는 칸도 만들어줘").
// 내 정보(/settings/account)의 마을 한마디 칸과 같은 Server Action(updateGreeting)·같은 검사(GREETING_MAX)를 쓴다.
// 광장 ☰ 메뉴에서는 ✎로 고치고, 휴대폰 메뉴(/town?menu=1)에서는 보기만 한다 (editable=false)
import { useActionState, useState } from "react";
import { updateGreeting } from "@/app/settings/account/greeting-actions";
import type { FormState } from "@/app/settings/blog/actions";
import { PixelIcon } from "@/components/pixel-icon";
import { GREETING_MAX } from "@/lib/town-talk";

export function GreetingQuickEdit({ greeting, editable }: { greeting: string | null; editable: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateGreeting, {});
  // 연 때의 저장 표시(state.ok). 그 뒤 새로 저장에 성공하면(ok가 바뀌면) 고친 값을 보여 주고 닫는다
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const editing = openedAt !== null && !(state.ok && state.ok !== openedAt);
  const saved = state.ok ? (state.values?.greeting ?? "") : null;
  const current = saved ?? greeting ?? "";

  return (
    <div className="rounded-xl bg-cream/60 px-3 py-2 text-sm" data-greeting-quick>
      <div className="flex items-center gap-2">
        <PixelIcon name="chat" scale={1} />
        <span className="font-bold">마을 한마디</span>
        {editable && !editing && (
          <button
            type="button"
            onClick={() => setOpenedAt(state.ok ?? 0)}
            className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-white"
            aria-label="마을 한마디 고치기"
            data-greeting-edit
          >
            ✎
          </button>
        )}
      </div>
      {editing ? (
        <form action={action} className="mt-1 space-y-2">
          <input
            name="greeting"
            defaultValue={state.values?.greeting ?? current}
            maxLength={GREETING_MAX + 20}
            placeholder="예: 오늘도 좋은 하루 보내요!"
            aria-label="마을 한마디"
            aria-invalid={state.error ? true : undefined}
            className="pixel-input w-full text-sm"
            autoFocus
          />
          {state.error && (
            <p role="alert" className="text-xs font-bold text-berry">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpenedAt(null)} className="btn min-h-11 text-sm">
              취소
            </button>
            <button type="submit" disabled={pending} className="btn min-h-11 bg-leaf text-sm text-white" data-greeting-save>
              저장
            </button>
          </div>
        </form>
      ) : (
        <p className={`mt-0.5 break-words ${current ? "" : "text-ink-soft"}`} data-greeting-text>
          {current || "아직 없어요 (비워 두면 내 공개 글에서 한 문장을 골라요)"}
        </p>
      )}
      <p className="mt-1 text-xs text-ink-soft">친구 마을에서 나를 누르면 말풍선으로 보여요{saved !== null && !editing ? " · 저장했어요 ✓" : ""}</p>
    </div>
  );
}
