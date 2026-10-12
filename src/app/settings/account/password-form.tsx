"use client";

// 회원정보 수정의 비밀번호 변경 칸 (AUTH-11). 결과 문구는 [비밀번호 바꾸기] 위 한 줄.
// 성공·실패 모두 칸을 비운다 (폼 action이 끝나면 React가 폼을 초기화한다)
import { useActionState } from "react";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password";
import { changePassword, type PasswordFormState } from "./password-actions";

const FIELDS = [
  { name: "currentPassword", label: "지금 비밀번호", autoComplete: "current-password" },
  { name: "newPassword", label: "새 비밀번호", autoComplete: "new-password" },
  { name: "newPasswordConfirm", label: "새 비밀번호 확인", autoComplete: "new-password" },
] as const;

export function PasswordForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<PasswordFormState, FormData>(changePassword, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      {/* 비밀번호 관리자가 어느 계정의 비밀번호인지 알 수 있게 (보이지 않는 아이디 칸) */}
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
      {FIELDS.map((f) => (
        <div key={f.name} className="flex flex-col gap-2 px-[3px]">
          <label htmlFor={f.name} className="text-sm font-bold">
            {f.label}
          </label>
          <input
            id={f.name}
            type="password"
            name={f.name}
            autoComplete={f.autoComplete}
            maxLength={PASSWORD_MAX}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "password-error" : f.name === "newPassword" ? "password-rule" : undefined}
            className="pixel-input"
          />
          {f.name === "newPassword" && (
            <span id="password-rule" className="text-xs text-ink-soft">
              {PASSWORD_MIN}~{PASSWORD_MAX}자
            </span>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error ? (
          <span id="password-error" role="alert" className="text-sm font-bold text-berry">
            {state.error}
          </span>
        ) : state.ok ? (
          <span role="status" className="text-sm text-leaf-dark">
            비밀번호를 바꿨어요 ✓ 다른 기기에서는 다시 로그인해 주세요
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="pixel-btn pixel-btn-sm min-w-11 shrink-0 whitespace-nowrap bg-leaf px-4 text-white"
        >
          {pending ? "바꾸는 중..." : "비밀번호 바꾸기"}
        </button>
      </div>
    </form>
  );
}
