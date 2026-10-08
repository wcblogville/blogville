"use client";

// 첫 화면의 로그인·회원가입 카드 (AUTH-01, AUTH-02 / FR-001, FR-002, FR-004, FR-005, FR-030, FR-031, FR-054)
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/(auth)/actions";
import { CharacterArt } from "@/components/character";
import { authClient } from "@/lib/auth-client";

type Providers = { google: boolean; kakao: boolean; naver: boolean };
export type Starter = { id: number; code: string; name: string; description: string | null; assetKey: string };

const SOCIAL = [
  { id: "kakao", label: "카카오", className: "bg-[#FEE500] text-[#191919]" },
  { id: "naver", label: "네이버", className: "bg-[#03C75A] text-white" },
  { id: "google", label: "Google", className: "bg-white text-ink border-2 border-line" },
] as const;

const input = "w-full rounded-xl border-2 border-line bg-white px-3 py-2.5 outline-none focus:border-sun";
// 누르는 영역 44×44px 이상, 글자 한 줄, 키보드 초점 표시 (FR-054)
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2";

function SignInForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-3">
      <input name="username" defaultValue={state.values?.username} placeholder="아이디" autoComplete="username" required className={input} aria-label="아이디" />
      <input name="password" type="password" placeholder="비밀번호" autoComplete="current-password" required className={input} aria-label="비밀번호" />
      {state.error && <p role="alert" className="text-sm font-bold text-berry">{state.error}</p>}
      <button disabled={pending} className={`btn min-h-11 w-full whitespace-nowrap bg-leaf py-3 text-white ${focusRing}`}>
        {pending ? "들어가는 중..." : "로그인"}
      </button>
    </form>
  );
}

function SignUpForm({ starters }: { starters: Starter[] }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});
  // 처음에는 남자 주민(char_boy)을 골라 둔다. 오류 뒤에는 고른 캐릭터를 그대로 둔다 (FR-005)
  const defaultId = starters.find((s) => s.code === "char_boy")?.id ?? starters[0]?.id;
  const chosen = state.values?.characterId ? Number(state.values.characterId) : defaultId;

  return (
    <form action={action} className="space-y-3">
      <div>
        <input
          name="username"
          defaultValue={state.values?.username}
          placeholder="아이디"
          autoComplete="username"
          required
          maxLength={20}
          className={input}
          aria-label="아이디"
          aria-describedby="signup-username-hint"
        />
        <p id="signup-username-hint" className="mt-1 text-xs text-ink-soft">
          영문 소문자, 숫자, _ 로 4~20자
        </p>
      </div>
      <input name="password" type="password" placeholder="비밀번호 (8자 이상)" autoComplete="new-password" required maxLength={64} className={input} aria-label="비밀번호" />
      <input name="passwordConfirm" type="password" placeholder="비밀번호 확인" autoComplete="new-password" required maxLength={64} className={input} aria-label="비밀번호 확인" />

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold">캐릭터 고르기</legend>
        <div className="grid grid-cols-2 gap-2">
          {starters.map((c) => (
            <label key={c.id} className="cursor-pointer">
              <input type="radio" name="characterId" value={c.id} defaultChecked={c.id === chosen} className="peer sr-only" />
              <span className="flex min-h-11 flex-col items-center rounded-2xl border-2 border-line bg-white p-2 text-center transition peer-checked:border-sun peer-checked:bg-[#fff3d6] peer-checked:shadow-[0_3px_0_0_var(--color-sun-dark)] peer-focus-visible:ring-2 peer-focus-visible:ring-sky peer-focus-visible:ring-offset-2">
                <CharacterArt asset={c.assetKey} size={56} />
                <span className="mt-1 whitespace-nowrap text-sm font-bold">{c.name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 오류는 [회원가입] 바로 위에 빨간 굵은 글씨 한 줄 (FR-005) */}
      {state.error && <p role="alert" className="text-sm font-bold text-berry">{state.error}</p>}
      <button disabled={pending} className={`btn min-h-11 w-full whitespace-nowrap bg-sun py-3 text-ink ${focusRing}`}>
        {pending ? "가입하는 중..." : "회원가입"}
      </button>
    </form>
  );
}

export function LoginButtons({ providers, starters }: { providers: Providers; starters: Starter[] }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const anySocial = providers.google || providers.kakao || providers.naver;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-cream p-1" role="tablist">
        {(["signin", "signup"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 whitespace-nowrap rounded-lg py-2 font-bold ${focusRing} ${tab === t ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
          >
            {t === "signin" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      {tab === "signin" ? <SignInForm /> : <SignUpForm starters={starters} />}

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
            className={`btn min-h-11 whitespace-nowrap px-2 py-2.5 text-sm ${focusRing} ${p.className}`}
            onClick={() => authClient.signIn.social({ provider: p.id, callbackURL: "/town" })}
          >
            {p.label}
          </button>
        ))}
      </div>
      {!anySocial && <p className="mt-2 text-center text-xs text-ink-soft">간편 로그인은 준비 중이에요</p>}
      <p className="mt-1 text-center text-xs text-ink-soft">처음이라면 회원가입 후 내 정보에서 연동해 주세요</p>
    </div>
  );
}
