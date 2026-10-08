// 내 정보 (AUTH-05 / FR-036~FR-042, FR-054, contracts/account.md 1장)
// - 로그인 수단: 아이디 로그인(해제 없음) + 카카오·네이버·Google 연동·해제
// - blog(BLOG-03)가 닉네임 변경 칸을 "닉네임" 영역에 올린다.
// - 회원 탈퇴 (AUTH-06 / FR-050~FR-052, contracts/account.md 4장): 비밀번호를 다시 확인하고 바로 지운다 (유예 없음)
import { formatDate } from "@/lib/format";
import { isSocialProvider, SOCIAL_LABEL } from "@/lib/social";
import { getSocialLogins } from "@/server/account";
import { requireMember } from "@/server/dal";
import { DeleteAccountForm, LinkSocialButton, UnlinkSocialButton } from "./account-forms";

export const metadata = { title: "내 정보" };

// 연동하려던 소셜 계정이 이미 다른 회원에 연동되어 있을 때 라이브러리가 붙이는 오류 코드 (better-auth 1.7.7 link-account.mjs)
const ALREADY_LINKED_ERROR = "account_already_linked_to_different_user";

export default async function AccountSettingsPage({ searchParams }: PageProps<"/settings/account">) {
  const viewer = await requireMember();
  const [logins, params] = await Promise.all([getSocialLogins(viewer.userId), searchParams]);

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
      <h1 className="font-display text-3xl">🙂 내 정보</h1>

      <section className="card mt-6 p-6" aria-labelledby="login-title" data-section="logins">
        <h2 id="login-title" className="font-display text-xl">
          로그인 수단
        </h2>
        {notice && (
          <p
            role={notice.ok ? "status" : "alert"}
            className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${notice.ok ? "bg-[#e3f5e1] text-leaf-dark" : "bg-[#fde8e8] text-berry"}`}
          >
            {notice.text}
          </p>
        )}
        <ul className="mt-4 divide-y-2 divide-line">
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

      {/* 닉네임: blog가 변경 칸을 올릴 자리 (BLOG-03) */}
      <section className="card mt-6 p-6" aria-labelledby="nickname-title" data-section="nickname">
        <h2 id="nickname-title" className="font-display text-xl">
          닉네임
        </h2>
        <p className="mt-2">{viewer.profile.nickname}</p>
      </section>

      {/* 회원 탈퇴 (AUTH-06). 안내·버튼 문구는 spec에 없음 — 제안 (plan 남은 문제 1) */}
      <section className="card mt-6 p-6" aria-labelledby="withdraw-title" data-section="withdraw">
        <h2 id="withdraw-title" className="font-display text-xl">
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
