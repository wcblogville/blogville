"use client";

// 새 비밀번호 칸 (AUTH-12). 지금 비밀번호 칸이 없다 (간편 로그인 직후의 새 세션만 이 화면을 쓴다).
// 성공하면 폼 대신 완료 안내와 광장 링크를 보인다
import Link from "next/link";
import { useActionState } from "react";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password";
import { setNewPassword, type NewPasswordState } from "./actions";

const FIELDS = [
  { name: "newPassword", label: "새 비밀번호" },
  { name: "newPasswordConfirm", label: "새 비밀번호 확인" },
] as const;

export function NewPasswordForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<NewPasswordState, FormData>(setNewPassword, {});

  if (state.ok) {
    return (
      <div className="mt-3" data-new-password-done>
        <p role="status" className="font-bold text-leaf-dark">
          새 비밀번호를 정했어요 ✓ 다음부터 아이디 <b>{username}</b>와 새 비밀번호로 로그인할 수 있어요.
        </p>
        <p className="mt-1 text-sm text-ink-soft">다른 기기의 로그인은 끊겼어요.</p>
        <Link href="/town" className="pixel-btn mt-4 inline-flex min-h-11 items-center whitespace-nowrap bg-leaf px-4 text-white">
          광장으로 가기 →
        </Link>
      </div>
    );
  }

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
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "new-password-error" : f.name === "newPassword" ? "new-password-rule" : undefined}
            className="pixel-input"
          />
          {f.name === "newPassword" && (
            <span id="new-password-rule" className="text-xs text-ink-soft">
              {PASSWORD_MIN}~{PASSWORD_MAX}자
            </span>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error && (
          <span id="new-password-error" role="alert" className="text-sm font-bold text-berry">
            {state.error}
          </span>
        )}
        <button type="submit" disabled={pending} className="pixel-btn pixel-btn-sm min-w-11 shrink-0 whitespace-nowrap bg-leaf px-4 text-white">
          {pending ? "정하는 중..." : "새 비밀번호 정하기"}
        </button>
      </div>
    </form>
  );
}
