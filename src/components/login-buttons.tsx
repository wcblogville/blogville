"use client";

// 첫 화면의 로그인·회원가입 카드 (AUTH-01, AUTH-02, AUTH-09 / FR-001, FR-002, FR-004, FR-005, FR-030~FR-033, FR-054)
import { useActionState, useState } from "react";
import { signIn, signUp, startSocialSignIn, type AuthFormState } from "@/app/(auth)/actions";
import { CharacterArt } from "@/components/character";
import type { SocialReady } from "@/lib/social";

type Providers = SocialReady;
export type Starter = { id: number; code: string; name: string; description: string | null; assetKey: string };

const SOCIAL = [
  { id: "kakao", label: "카카오", className: "bg-[#FEE500] text-[#191919]" },
  { id: "naver", label: "네이버", className: "bg-[#03C75A] text-white" },
  { id: "google", label: "Google", className: "bg-white text-ink border-2 border-line" },
] as const;

const input = "w-full rounded-xl border-2 border-line bg-white px-3 py-2.5 outline-none focus:border-sun";
// 누르는 영역 44×44px 이상, 글자 한 줄, 키보드 초점 표시 (FR-054)
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2";

// [로그인 상태 유지]는 카드가 들고 있어 같은 카드의 소셜 버튼에도 쓴다 (research R7)
type Remember = { remember: boolean; setRemember: (v: boolean) => void };

function SignInForm({ remember, setRemember }: Remember) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {});
  return (
    // noValidate: 빈 칸은 브라우저 말풍선 대신 서버 문구 `아이디와 비밀번호를 적어 주세요`로 알린다 (FR-017)
    <form action={action} noValidate className="space-y-3">
      <input name="username" defaultValue={state.values?.username} placeholder="아이디" autoComplete="username" className={input} aria-label="아이디" />
      <input name="password" type="password" placeholder="비밀번호" autoComplete="current-password" className={input} aria-label="비밀번호" />
      {/* [로그인 상태 유지]: 처음엔 선택 안 됨. 고르면 7일, 아니면 브라우저 종료·마지막 사용 2시간 (FR-019~FR-021) */}
      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="rememberMe"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className={`size-5 accent-leaf ${focusRing}`}
        />
        로그인 상태 유지
      </label>
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
                <CharacterArt asset={c.assetKey} size={72} />
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

/**
 * 간편 로그인 버튼 (FR-030~FR-032). 키가 없는 서비스는 흐리게 비활성 + 마우스를 올리면 `아직 연결 준비 중이에요`.
 * 누르면 startSocialSignIn(Server Action)이 [로그인 상태 유지]를 쿠키로 남기고 소셜 서비스로 보낸다.
 */
function SocialButtons({ providers, remember }: { providers: Providers; remember: boolean }) {
  const [error, action, pending] = useActionState<string | undefined, FormData>(
    async (_prev, formData) => (await startSocialSignIn(String(formData.get("provider") ?? ""), remember)).error,
    undefined,
  );
  return (
    <form action={action}>
      <div className="grid grid-cols-3 gap-2">
        {SOCIAL.map((p) => (
          <button
            key={p.id}
            type="submit"
            name="provider"
            value={p.id}
            disabled={!providers[p.id] || pending}
            title={providers[p.id] ? `${p.label}로 로그인` : "아직 연결 준비 중이에요"}
            // 비활성이어도 마우스를 올리면 안내(title)가 보이게 한다 (.btn:disabled의 pointer-events: none을 되돌림)
            className={`btn min-h-11 whitespace-nowrap px-2 py-2.5 text-sm disabled:pointer-events-auto disabled:cursor-not-allowed ${focusRing} ${p.className}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-center text-sm font-bold text-berry">{error}</p>}
    </form>
  );
}

/** socialError: 소셜 로그인에서 돌아온 오류 문구 (연동 없음, FR-033). 첫 화면(page.tsx)이 오류 코드로 정한다 */
export function LoginButtons({ providers, starters, socialError }: { providers: Providers; starters: Starter[]; socialError?: string }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [remember, setRemember] = useState(false);
  const anySocial = providers.google || providers.kakao || providers.naver;

  return (
    <div className="w-full max-w-sm">
      {socialError && (
        <p role="alert" className="mb-4 rounded-xl bg-[#fde8e8] px-3 py-2 text-sm font-bold text-berry">
          {socialError}
        </p>
      )}
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

      {tab === "signin" ? <SignInForm remember={remember} setRemember={setRemember} /> : <SignUpForm starters={starters} />}

      <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        간편 로그인
        <span className="h-px flex-1 bg-line" />
      </div>
      {/* 회원가입 탭에는 [로그인 상태 유지]가 없으므로 그때는 유지 안 함 */}
      <SocialButtons providers={providers} remember={tab === "signin" && remember} />
      {!anySocial && <p className="mt-2 text-center text-xs text-ink-soft">간편 로그인은 준비 중이에요</p>}
      <p className="mt-1 text-center text-xs text-ink-soft">처음이라면 회원가입 후 내 정보에서 연동해 주세요</p>
    </div>
  );
}
