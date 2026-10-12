"use client";

// 내 정보의 "마을 한마디" 칸 (사용자 요청 2026-10-12). 닉네임 칸과 같은 모양: 결과 문구는 [저장] 왼쪽 한 줄
import { useActionState } from "react";
import type { FormState } from "@/app/settings/blog/actions";
import { GREETING_MAX } from "@/lib/town-talk";
import { updateGreeting } from "./greeting-actions";

export function GreetingForm({ greeting }: { greeting: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateGreeting, {});
  return (
    <form action={action} className="mt-3 space-y-3 px-[3px]">
      <label htmlFor="greeting" className="block font-bold">
        마을 한마디
      </label>
      <input
        id="greeting"
        name="greeting"
        defaultValue={state.values?.greeting ?? greeting ?? ""}
        maxLength={GREETING_MAX + 20}
        placeholder="예: 오늘도 좋은 하루 보내요!"
        aria-invalid={state.error ? true : undefined}
        aria-describedby="greeting-hint"
        className="pixel-input"
      />
      <p id="greeting-hint" className="text-xs text-ink-soft">
        이웃이 마을에서 내 캐릭터에게 말을 걸면 말풍선으로 보여요 ({GREETING_MAX}자까지). 비워 두면 내 공개 글에서 한 문장을 골라 보여 줘요.
      </p>
      <div className="flex items-center justify-end gap-3">
        {state.error ? (
          <span role="alert" className="text-sm font-bold text-berry">
            {state.error}
          </span>
        ) : state.ok ? (
          <span role="status" className="text-sm text-leaf-dark">
            저장했어요 ✓
          </span>
        ) : null}
        <button type="submit" disabled={pending} className="pixel-btn pixel-btn-sm min-w-11 shrink-0 whitespace-nowrap bg-leaf px-4 text-white">
          저장
        </button>
      </div>
    </form>
  );
}
