// 비밀번호 찾기 (AUTH-12, 2026-10-13 사용자 요청 "로그인 창에 비밀번호 찾기 버튼 만들어줘").
// 회원 이메일은 가짜(아이디@users.blogville.invalid)라 메일로 보낼 수 없다. 길은 둘이다.
// 1) 간편 로그인을 연동했다면: 소셜로 로그인 → 새 비밀번호 화면(/settings/account/new-password, 새 세션 10분 안)
// 2) 연동하지 않았다면: 관리자에게 아이디를 알려 임시 비밀번호를 받는다 (/admin 비밀번호 초기화)
// 로그인 전 화면이라 권한 검사가 없다. 이미 로그인했다면 새 비밀번호 화면으로 보낸다
import Link from "next/link";
import { redirect } from "next/navigation";
import { SocialButtons, SocialErrorBanner } from "@/components/login-buttons";
import { PixelIcon } from "@/components/pixel-icon";
import { enabledProviders } from "@/lib/auth";
import { FRESH_SESSION_MS, NEW_PASSWORD_PATH } from "@/lib/password-reset";
import { socialErrorMessage } from "@/lib/social-errors";
import { getViewer } from "@/server/dal";

export const metadata = { title: "비밀번호 찾기" };

const focusRing = "focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky";

export default async function FindPasswordPage({ searchParams }: PageProps<"/find-password">) {
  if (await getViewer()) redirect(NEW_PASSWORD_PATH);
  const { error, provider } = await searchParams;

  // 소셜에서 돌아온 오류 (startSocialSignIn의 errorCallbackURL). 연동 없음은 이 화면에 맞게 관리자 길을 알린다
  const found = socialErrorMessage(error, { place: "login", provider });
  const notice =
    found?.kind === "notLinked" ? { ...found, text: "연동된 계정이 없어요. 아래 방법처럼 관리자에게 임시 비밀번호를 부탁해 주세요" } : found;
  const anySocial = enabledProviders.google || enabledProviders.kakao || enabledProviders.naver;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="pixel-sign text-2xl sm:text-3xl">
        <PixelIcon name="lock" scale={2} />
        비밀번호 찾기
      </h1>
      <p className="mt-4 text-sm text-ink-soft">
        Blogville은 이메일을 받지 않아서 메일로 비밀번호를 보내 드릴 수 없어요. 아래 두 방법 중 하나로 새 비밀번호를 정해 주세요.
      </p>

      {notice && (
        <div className="mt-6">
          <SocialErrorBanner notice={notice} />
        </div>
      )}

      <section className="pixel-card mt-6 p-5 sm:p-6" aria-labelledby="find-social-title" data-section="find-social">
        <h2 id="find-social-title" className="font-display text-xl">
          간편 로그인을 연동했다면
        </h2>
        <p className="mt-2 text-sm">
          연동한 서비스로 로그인하면 지금 비밀번호 없이 바로 새 비밀번호를 정할 수 있어요. 로그인하고 {FRESH_SESSION_MS / 60_000}분 안에 정해 주세요.
        </p>
        <div className="mt-4">
          <SocialButtons providers={enabledProviders} remember={false} next={NEW_PASSWORD_PATH} />
        </div>
        {!anySocial && <p className="mt-2 text-center text-xs text-ink-soft">간편 로그인은 준비 중이에요</p>}
      </section>

      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="find-admin-title" data-section="find-admin">
        <h2 id="find-admin-title" className="font-display text-xl">
          연동하지 않았다면
        </h2>
        <p className="mt-2 text-sm">
          관리자에게 <b>내 아이디</b>를 알려 주세요. 관리자가 임시 비밀번호를 만들어 드려요.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          임시 비밀번호로 로그인한 뒤 회원정보 수정의 비밀번호 변경에서 꼭 내 비밀번호로 바꿔 주세요.
        </p>
      </section>

      <p className="mt-8 text-center">
        <Link
          href="/#login"
          className={`pixel-btn inline-flex min-h-11 items-center whitespace-nowrap bg-white px-4 text-ink ${focusRing}`}
        >
          ← 로그인 화면으로
        </Link>
      </p>
    </div>
  );
}
