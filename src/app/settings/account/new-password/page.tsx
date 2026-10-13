// 새 비밀번호 정하기 (AUTH-12 비밀번호 찾기). 비밀번호 찾기 화면의 간편 로그인이 끝나면 여기로 온다.
// 로그인한 지 FRESH_SESSION_MS(10분) 안의 세션만 지금 비밀번호 없이 바꿀 수 있다. 지났으면 다시 로그인하라고 안내한다.
// 저장할 때 setNewPassword가 같은 확인을 서버에서 다시 한다
import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { SignOutButton } from "@/components/sign-out-button";
import { freshMinutesLeft, FRESH_SESSION_MS, isFreshSession } from "@/lib/password-reset";
import { requireMember } from "@/server/dal";
import { sessionCreatedAt } from "@/server/password-reset";
import { NewPasswordForm } from "./new-password-form";

export const metadata = { title: "새 비밀번호 정하기" };

const PLANK = "pb-plank -mx-5 -mt-5 mb-4 px-5 py-2 font-display text-xl sm:-mx-6 sm:-mt-6 sm:px-6";
const linkTap = "inline-flex min-h-11 items-center font-bold text-leaf-dark underline-offset-2 hover:underline";

export default async function NewPasswordPage() {
  const viewer = await requireMember();
  const createdAt = await sessionCreatedAt(viewer.sessionId);
  const fresh = createdAt !== null && isFreshSession(createdAt);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="pixel-sign text-2xl sm:text-3xl">
        <PixelIcon name="key" scale={2} />새 비밀번호 정하기
      </h1>

      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="new-password-title" data-section="new-password" data-fresh={fresh ? "1" : "0"}>
        <h2 id="new-password-title" className={PLANK}>
          {viewer.user.username}님의 새 비밀번호
        </h2>
        {fresh ? (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              방금 로그인해서 지금 비밀번호 없이 바꿀 수 있어요 (약 {freshMinutesLeft(createdAt)}분 남음). 바꾸면 이 브라우저는 그대로 로그인되고, 다른 기기에서는
              로그아웃돼요.
            </p>
            <NewPasswordForm username={viewer.user.username ?? ""} />
          </>
        ) : (
          <div className="mt-2 space-y-3 text-sm" data-stale>
            <p>
              지금 비밀번호 없이 바꾸려면 로그인한 지 {FRESH_SESSION_MS / 60_000}분이 안 됐어야 해요. 로그아웃한 뒤 비밀번호 찾기에서 간편 로그인으로 다시
              들어와 주세요.
            </p>
            <p className="text-ink-soft">지금 비밀번호를 안다면 회원정보 수정의 비밀번호 변경에서 바꿀 수 있어요.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/settings/account" className={linkTap}>
                회원정보 수정으로 →
              </Link>
              <SignOutButton userId={viewer.userId} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
