"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/(auth)/actions";
import { authClient } from "@/lib/auth-client";

type Providers = { google: boolean; kakao: boolean; naver: boolean };

const SOCIAL = [
  { id: "kakao", label: "카카오", className: "bg-[#FEE500] text-[#191919]" },
  { id: "naver", label: "네이버", className: "bg-[#03C75A] text-white" },
  { id: "google", label: "Google", className: "bg-white text-ink border-2 border-line" },
] as const;

const input = "w-full rounded-xl border-2 border-line bg-white px-3 py-2.5 outline-none focus:border-sun";

function SignInForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-3">
      <input name="username" defaultValue={state.values?.username} placeholder="아이디" autoComplete="username" required className={input} aria-label="아이디" />
      <input name="password" type="password" placeholder="비밀번호" autoComplete="current-password" required className={input} aria-label="비밀번호" />
      {state.error && <p className="text-sm font-bold text-berry">{state.error}</p>}
      <button disabled={pending} className="btn w-full bg-leaf py-3 text-white">
        {pending ? "들어가는 중..." : "로그인"}
      </button>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <input name="username" defaultValue={state.values?.username} placeholder="아이디" autoComplete="username" required minLength={4} maxLength={20} className={input} aria-label="아이디" />
        <p className="mt-1 text-xs text-ink-soft">영문 소문자, 숫자, _ 로 4~20자</p>
      </div>
      <input name="password" type="password" placeholder="비밀번호 (8자 이상)" autoComplete="new-password" required minLength={8} maxLength={64} className={input} aria-label="비밀번호" />
      <input name="passwordConfirm" type="password" placeholder="비밀번호 확인" autoComplete="new-password" required className={input} aria-label="비밀번호 확인" />
      {state.error && <p className="text-sm font-bold text-berry">{state.error}</p>}
      <button disabled={pending} className="btn w-full bg-sun py-3 text-ink">
        {pending ? "가입하는 중..." : "회원가입"}
      </button>
    </form>
  );
}

export function LoginButtons({ providers }: { providers: Providers }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const anySocial = providers.google || providers.kakao || providers.naver;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-cream p-1" role="tablist">
        {(["signin", "signup"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 font-bold ${tab === t ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
          >
            {t === "signin" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      {tab === "signin" ? <SignInForm /> : <SignUpForm />}

      <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        간편 로그인
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SOCIAL.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!providers[p.id]}
            title={providers[p.id] ? `${p.label}로 시작하기` : "아직 연결 준비 중이에요"}
            className={`btn py-2.5 text-sm ${p.className}`}
            onClick={() => authClient.signIn.social({ provider: p.id, callbackURL: "/town" })}
          >
            {p.label}
          </button>
        ))}
      </div>
      {!anySocial && <p className="mt-2 text-center text-xs text-ink-soft">간편 로그인은 준비 중이에요</p>}
    </div>
  );
}
