// 내 정보 (AUTH-05 / FR-036). 지금은 골격만 있다.
// - blog(BLOG-03)가 닉네임 변경 칸을 "닉네임" 영역에 올린다.
// - 소셜 연동·해제(AUTH-05), 회원 탈퇴(AUTH-10)는 auth의 다음 단계에서 이 화면에 더한다.
import { requireMember } from "@/server/dal";

export const metadata = { title: "내 정보" };

export default async function AccountSettingsPage() {
  const viewer = await requireMember();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-3xl">🙂 내 정보</h1>
      <p className="mt-2 text-sm text-ink-soft">
        아이디 <b className="text-ink">{viewer.user.username}</b>
      </p>

      {/* 닉네임: blog가 변경 칸을 올릴 자리 (BLOG-03) */}
      <section className="card mt-6 p-6" aria-labelledby="nickname-title" data-section="nickname">
        <h2 id="nickname-title" className="font-display text-xl">
          닉네임
        </h2>
        <p className="mt-2">{viewer.profile.nickname}</p>
      </section>
    </div>
  );
}
