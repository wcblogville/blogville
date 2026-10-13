"use client";

// 관리자 비밀번호 초기화 폼 (AUTH-12 비밀번호 찾기). 누르는 영역 44px, 버튼 글자 한 줄 (FR-054)
// 임시 비밀번호는 이 화면에서 한 번만 보인다 (다시 그리면 사라진다). 복사해서 회원에게 알려 준다
import { useActionState, useState } from "react";
import { PixelIcon } from "@/components/pixel-icon";
import { adminResetPassword, type AdminResetPasswordState } from "./actions";

export function AdminResetPasswordForm() {
  const [state, action, pending] = useActionState<AdminResetPasswordState, FormData>(adminResetPassword, {});
  const [copied, setCopied] = useState<number | null>(null);
  const copy = async () => {
    if (!state.ok) return;
    try {
      await navigator.clipboard.writeText(state.tempPassword);
      setCopied(state.at);
    } catch {
      // 복사가 막힌 브라우저: 글자를 직접 골라 복사하면 된다
    }
  };

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const name = new FormData(e.currentTarget).get("username");
        if (!confirm(`'${String(name ?? "").trim()}' 회원의 비밀번호를 임시 비밀번호로 바꾸고 로그인을 모두 끊을까요?`)) e.preventDefault();
      }}
      className="space-y-4"
      data-admin-reset-password
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-0 flex-1 text-sm sm:max-w-xs">
          <span className="font-bold">회원 아이디</span>
          <input name="username" className="pixel-input mt-1 w-full" placeholder="예: tester1" autoComplete="off" maxLength={64} required />
        </label>
        <button type="submit" disabled={pending} className="pixel-btn min-h-11 shrink-0 whitespace-nowrap bg-berry px-3 text-sm text-white">
          {pending ? "만드는 중" : "임시 비밀번호 만들기"}
        </button>
      </div>
      <div aria-live="polite">
        {state.ok === false && (
          <p className="text-sm font-bold text-berry" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <div className="space-y-2 bg-[#fff6d8] p-3 text-sm shadow-[inset_0_0_0_2px_#e2c77f]" data-reset-result>
            <p>
              <PixelIcon name="check" scale={1} label="완료" className="mr-1 align-[-1px]" />
              <b>{state.nickname ?? state.username}</b> (@{state.username})의 비밀번호를 바꾸고 로그인을 모두 끊었어요.
            </p>
            <p className="flex flex-wrap items-center gap-2">
              임시 비밀번호
              <code className="select-all bg-white px-2 py-1 font-mono text-base tracking-wider" data-temp-password>
                {state.tempPassword}
              </code>
              <button type="button" onClick={copy} className="pixel-btn pixel-btn-sm min-h-11 shrink-0 whitespace-nowrap bg-white px-3 text-ink">
                {copied === state.at ? "복사했어요" : "복사"}
              </button>
            </p>
            <p className="text-ink-soft">
              이 화면을 벗어나면 다시 볼 수 없어요. 회원에게 알려 주고, 로그인한 뒤 회원정보 수정에서 꼭 비밀번호를 바꾸라고 안내해 주세요.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
