"use client";

// 내 정보의 소셜 연동·해제 버튼 (AUTH-05 / FR-036~FR-041, FR-054)과 탈퇴 폼 (AUTH-06 / FR-050)
import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { SocialProvider } from "@/lib/social";
import { deleteAccount, startLinkSocial, unlinkSocial, type DeleteAccountState } from "./actions";

// 누르는 영역 44×44px 이상, 글자 한 줄, 키보드 초점 표시 (FR-054)
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2";

function LinkSubmit({ label, ready }: { label: string; ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!ready || pending}
      title={ready ? undefined : "아직 연결 준비 중이에요"}
      // 비활성이어도 마우스를 올리면 안내(title)가 보이게 한다 (.btn:disabled의 pointer-events: none을 되돌림)
      className={`btn min-h-11 whitespace-nowrap bg-leaf px-3 py-2 text-sm text-white disabled:pointer-events-auto disabled:cursor-not-allowed ${focusRing}`}
    >
      {pending ? "이동하는 중..." : `${label} 연동하기`}
    </button>
  );
}

/** [{서비스} 연동하기]. 키가 없는 서비스는 흐리게 비활성 + `아직 연결 준비 중이에요` */
export function LinkSocialButton({ provider, label, ready }: { provider: SocialProvider; label: string; ready: boolean }) {
  return (
    <form action={() => startLinkSocial(provider)}>
      <LinkSubmit label={label} ready={ready} />
    </form>
  );
}

/** [연동 해제]. 확인 창을 거쳐 그 서비스 연결만 지운다 (FR-040). 아이디 로그인은 해제 버튼이 없다 (FR-041) */
export function UnlinkSocialButton({ provider, label }: { provider: SocialProvider; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border-2 border-line bg-white px-3 text-sm font-bold text-berry hover:bg-cream disabled:opacity-50 ${focusRing}`}
      onClick={() => confirm(`${label} 연동을 해제할까요? 아이디 로그인은 그대로 쓸 수 있어요`) && start(() => unlinkSocial(provider))}
    >
      {pending ? "해제하는 중..." : "연동 해제"}
    </button>
  );
}

/**
 * 회원 탈퇴 폼: 비밀번호를 다시 적고 [회원 탈퇴] (버튼 문구는 spec에 없음 — 제안).
 * 처리 중에는 누를 수 없다. 오류가 나면 비밀번호 칸은 비운다 (폼 action이 끝나면 React가 폼을 초기화한다).
 */
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">비밀번호</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          maxLength={64}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "delete-account-error" : undefined}
          className="min-h-11 w-full rounded-xl border-2 border-line bg-white px-3 py-2 outline-none focus:border-sun"
        />
      </label>
      {state.error && (
        <p id="delete-account-error" role="alert" className="text-sm font-bold text-berry">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className={`btn min-h-11 min-w-11 whitespace-nowrap bg-berry px-4 py-2 text-sm text-white disabled:opacity-50 ${focusRing}`}
        >
          {pending ? "탈퇴하는 중..." : "회원 탈퇴"}
        </button>
      </div>
    </form>
  );
}
