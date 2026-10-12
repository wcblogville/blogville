// 회원정보 수정 (예전 이름 "내 정보", 2026-10-12 사용자 요청 "회원정보 수정 페이지 만들어서 비밀번호 변경이라던가 정보 수정하게")
// - 기본 정보: 아이디(바꿀 수 없음)·가입일, 블로그 이름·주소는 블로그 관리로 보낸다 (같은 칸을 두 벌 두지 않는다)
// - 프로필: 사진(profiles.photo_key) + 닉네임 (BLOG-03)
// - 비밀번호 변경 (AUTH-11)
// - 로그인 수단: 아이디 로그인(해제 없음) + 카카오·네이버·Google 연동·해제
// - blog(BLOG-03)가 닉네임 변경 칸을 "닉네임" 영역에 올린다.
// - 회원 탈퇴 (AUTH-06 / FR-050~FR-052, contracts/account.md 4장): 비밀번호를 다시 확인하고 바로 지운다 (유예 없음)
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { isSocialProvider, SOCIAL_LABEL } from "@/lib/social";
import { getSocialLogins } from "@/server/account";
import { requireMember } from "@/server/dal";
import { DeleteAccountForm, LinkSocialButton, UnlinkSocialButton } from "./account-forms";
import { getGreeting } from "@/server/town";
import { GreetingForm } from "./greeting-form";
import { NicknameForm } from "./nickname-form";
import { PasswordForm } from "./password-form";
import { PhotoForm } from "./photo-form";

export const metadata = { title: "회원정보 수정" };

// 연동하려던 소셜 계정이 이미 다른 회원에 연동되어 있을 때 라이브러리가 붙이는 오류 코드 (better-auth 1.7.7 link-account.mjs)
// 카드 제목 판자 (카드 위 가장자리에 붙는다)
const PLANK = "pb-plank -mx-5 -mt-5 mb-4 px-5 py-2 font-display text-xl sm:-mx-6 sm:-mt-6 sm:px-6";

const ALREADY_LINKED_ERROR = "account_already_linked_to_different_user";

export default async function AccountSettingsPage({ searchParams }: PageProps<"/settings/account">) {
  const viewer = await requireMember();
  const [logins, params, greeting] = await Promise.all([getSocialLogins(viewer.userId), searchParams, getGreeting(viewer.userId)]);

  // 소셜 서비스에서 돌아왔을 때의 문구. 연동 성공은 실제로 그 연동 행이 있을 때만 (주소를 손으로 만든 경우 제외).
  // 취소·동의 안 함 등 그 밖의 오류는 문구 없이 그대로 (spec Edge Case)
  const linked = params.linked;
  const failed = params.provider;
  const notice =
    isSocialProvider(linked) && logins.some((l) => l.provider === linked && l.linkedAt)
      ? { ok: true, text: `${SOCIAL_LABEL[linked]} 계정을 연동했어요` }
      : isSocialProvider(failed) && params.error === ALREADY_LINKED_ERROR
        ? { ok: false, text: `이미 다른 Blogville 계정에 연동된 ${SOCIAL_LABEL[failed]} 계정이에요` }
        : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="pixel-sign text-2xl sm:text-3xl">🙂 회원정보 수정</h1>

      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="basic-title" data-section="basic">
        <h2 id="basic-title" className={PLANK}>
          기본 정보
        </h2>
        <dl className="mt-2 divide-y-2 divide-dashed divide-[#e2c9a0]">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 py-2" data-field="username">
            <dt className="font-bold">아이디</dt>
            <dd className="min-w-0 break-all text-right">
              {viewer.user.username} <span className="text-xs text-ink-soft">(바꿀 수 없어요)</span>
            </dd>
          </div>
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 py-2" data-field="joined">
            <dt className="font-bold">가입일</dt>
            <dd>{formatDate(viewer.user.createdAt)}</dd>
          </div>
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 py-2" data-field="blog">
            <dt className="font-bold">내 블로그</dt>
            <dd className="flex min-w-0 flex-wrap items-center justify-end gap-x-3">
              <span className="min-w-0 break-all">
                {viewer.profile.blogTitle} <span className="text-xs text-ink-soft">/@{viewer.profile.blogSlug}</span>
              </span>
              <Link
                href="/settings/blog"
                className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap font-bold text-leaf-dark underline-offset-2 hover:underline"
              >
                블로그 관리 →
              </Link>
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-soft">블로그 이름·주소·소개는 블로그 관리에서 바꿀 수 있어요.</p>
      </section>

      {/* 프로필: 사진 + 닉네임 (BLOG-03 / FR-019, research R-29) */}
      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="profile-title" data-section="profile">
        <h2 id="profile-title" className={PLANK}>
          프로필 사진
        </h2>
        <PhotoForm photoKey={viewer.profile.photoKey} characterAsset={viewer.profile.characterAsset} outfit={viewer.profile.outfit} nickname={viewer.profile.nickname} />
      </section>

      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="nickname-title" data-section="nickname">
        <h2 id="nickname-title" className={PLANK}>
          닉네임
        </h2>
        <NicknameForm nickname={viewer.profile.nickname} />
        {/* 마을 한마디 (사용자 요청 2026-10-12): 마을에서 이웃이 말을 걸면 보이는 말풍선 */}
        <div className="mt-6 border-t-2 border-dashed border-[#e2c9a0] pt-4" data-section="greeting">
          <GreetingForm greeting={greeting} />
        </div>
      </section>

      {/* 비밀번호 변경 (AUTH-11). 바꾸면 다른 기기의 로그인은 끊긴다 */}
      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="password-title" data-section="password">
        <h2 id="password-title" className={PLANK}>
          비밀번호 변경
        </h2>
        <p className="mt-2 text-sm text-ink-soft">바꾸면 이 브라우저는 그대로 로그인되고, 다른 기기에서는 로그아웃돼요.</p>
        <PasswordForm username={viewer.user.username ?? ""} />
      </section>

      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="login-title" data-section="logins">
        <h2 id="login-title" className={PLANK}>
          로그인 수단
        </h2>
        {notice && (
          <p
            role={notice.ok ? "status" : "alert"}
            className={`mt-3 px-3 py-2 text-sm font-bold ${notice.ok ? "bg-[#e3f5e1] text-leaf-dark shadow-[inset_0_0_0_2px_#9fd39a]" : "bg-[#fde8e8] text-berry shadow-[inset_0_0_0_2px_#e7a3a3]"}`}
          >
            {notice.text}
          </p>
        )}
        <ul className="mt-2 divide-y-2 divide-dashed divide-[#e2c9a0]">
          {/* 아이디 로그인은 늘 남는다. 해제 버튼이 없다 (FR-041) */}
          <li className="flex min-h-14 items-center py-2" data-provider="credential">
            <span className="min-w-0 break-all font-bold">아이디 로그인 · {viewer.user.username}</span>
          </li>
          {logins.map((l) => (
            <li key={l.provider} className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-2" data-provider={l.provider}>
              <span className="font-bold">{l.label}</span>
              {l.linkedAt ? (
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <span className="whitespace-nowrap text-sm text-leaf-dark">연동됨 ({formatDate(l.linkedAt)})</span>
                  <UnlinkSocialButton provider={l.provider} label={l.label} />
                </span>
              ) : (
                <span className="flex flex-wrap items-center justify-end gap-2">
                  {!l.ready && <span className="text-xs text-ink-soft">아직 연결 준비 중이에요</span>}
                  <LinkSocialButton provider={l.provider} label={l.label} ready={l.ready} />
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-soft">연동한 소셜 계정으로 첫 화면 간편 로그인을 할 수 있어요. 서비스마다 계정 하나만 연동돼요.</p>
      </section>

      {/* 회원 탈퇴 (AUTH-06). 안내·버튼 문구는 spec에 없음 — 제안 (plan 남은 문제 1) */}
      <section className="pixel-card mt-8 p-5 sm:p-6" aria-labelledby="withdraw-title" data-section="withdraw">
        <h2 id="withdraw-title" className={PLANK}>
          회원 탈퇴
        </h2>
        <p className="mt-2 text-sm">
          탈퇴하면 바로 지워지고 되돌릴 수 없어요. 회원 정보·프로필·블로그와 글, 남의 글에 단 댓글과 답글, 코인·경험치 기록, 보유 아이템,
          연동한 소셜 계정 연결이 함께 지워져요.
        </p>
        <p className="mt-2 text-sm text-ink-soft">확인을 위해 비밀번호를 다시 적어 주세요.</p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
