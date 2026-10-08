"use client";

// 내 정보의 닉네임 칸 (BLOG-03 / FR-019, contracts/blog-home.md 4절). 파일은 blog 소유, 자리는 auth의 page.tsx.
// 결과 문구는 [저장] 왼쪽 한 줄. 성공 문구 `저장했어요 ✓`는 plan 임시 (블로그 관리와 같은 모양).
import { useActionState } from "react";
import type { FormState } from "@/app/settings/blog/actions";
import { updateNickname } from "./nickname-actions";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2";

export function NicknameForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateNickname, {});
  return (
    <form action={action} className="mt-3 space-y-2">
      {/* 카드 제목도 "닉네임"이라 라벨은 화면 읽기 프로그램에만 */}
      <label htmlFor="nickname" className="sr-only">
        닉네임
      </label>
      <input
        id="nickname"
        name="nickname"
        // 오류면 보낸 값, 성공이면 저장된 값 (research R-08)
        defaultValue={state.values?.nickname ?? nickname}
        maxLength={20}
        required
        autoComplete="nickname"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "nickname-error" : undefined}
        className="min-h-11 w-full rounded-xl border-2 border-line bg-white px-3 py-2 outline-none focus:border-sun"
      />
      <div className="flex items-center justify-end gap-3">
        {state.error ? (
          <span id="nickname-error" role="alert" className="text-sm font-bold text-berry">
            {state.error}
          </span>
        ) : state.ok ? (
          <span role="status" className="text-sm text-leaf-dark">
            저장했어요 ✓
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className={`btn min-h-11 min-w-11 shrink-0 whitespace-nowrap bg-leaf px-4 py-2 text-sm text-white disabled:opacity-50 ${focusRing}`}
        >
          저장
        </button>
      </div>
    </form>
  );
}
