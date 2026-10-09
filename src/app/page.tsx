import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { items } from "@/db/schema";
import { LoginButtons } from "@/components/login-buttons";
import { enabledProviders } from "@/lib/auth";
import { getViewer } from "@/server/dal";

// 소셜 로그인에서 돌아온 오류 코드 중 "연동된 계정이 없음"으로 보여줄 것 (FR-033, better-auth 1.7.7 callback.mjs로 확인)
// - signup_disabled: 어떤 회원에도 연동되지 않은 소셜 계정 (disableSignUp)
// - account_not_linked: 같은 이메일 회원이 있지만 자동 연결을 막음 (FR-034. 회원 이메일이 .invalid라 실제로는 생기지 않는다)
// - email_not_found: 사용자 정보에 이메일이 없음 (대체 이메일을 늘 넣으므로 생기지 않지만, 생기면 연동이 없는 것과 같다)
// 취소·동의 안 함(access_denied 등)과 그 밖의 코드는 문구 없이 첫 화면 그대로 (spec Edge Case)
const NOT_LINKED_ERRORS = new Set(["signup_disabled", "account_not_linked", "email_not_found"]);
const NOT_LINKED_MESSAGE = "연동된 계정이 없어요. 아이디로 로그인한 뒤 내 정보에서 연동해 주세요";

// 첫 화면 (AUTH-01, AUTH-02 / FR-001, FR-014, FR-031, FR-033, contracts/auth-entry.md 1장·4장)
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  // 로그인한 회원은 광장으로 (FR-014)
  if (await getViewer()) redirect("/town");

  // 가입 때 고를 수 있는 기본 캐릭터 (남자·여자 주민)
  const starters = await db
    .select({ id: items.id, code: items.code, name: items.name, description: items.description, assetKey: items.assetKey })
    .from(items)
    .where(and(eq(items.type, "character"), eq(items.isStarter, true)))
    .orderBy(asc(items.id));

  const { error } = await searchParams;
  const socialError = typeof error === "string" && NOT_LINKED_ERRORS.has(error) ? NOT_LINKED_MESSAGE : undefined;

  return (
    <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 md:grid-cols-2 md:gap-10 md:py-20">
      <section>
        <p className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-sm font-bold text-leaf-dark shadow-sm">
          🏘 블로그들이 모여 사는 마을
        </p>
        <h1 className="font-display text-5xl leading-tight md:text-6xl">
          글을 쓸수록
          <br />
          <span className="text-leaf-dark">내 마을</span>이 자라요
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          가입하면 내 블로그가 곧 내 집이에요. 문을 열고 나가면 이웃들이 사는 마을이 나와요.
          <br />
          글을 쓰고 출석하면 코인과 경험치가 쌓이고, 옷·가구·동물로 집을 꾸밀 수 있어요.
        </p>
        {/* 휴대폰에서는 숨긴다: 로그인 칸이 첫 화면 아래로 밀렸다 */}
        <ul className="mt-6 grid grid-cols-3 gap-3 text-center text-sm font-bold max-sm:hidden">
          <li className="card p-3">✏️<br />글쓰기</li>
          <li className="card p-3">🪙<br />보상</li>
          <li className="card p-3">🎨<br />꾸미기</li>
        </ul>
      </section>

      <section id="login" className="card flex scroll-mt-20 flex-col items-center gap-6 p-6 sm:p-8">
        <div className="text-5xl sm:text-7xl" aria-hidden>
          🧑🐱🐶
        </div>
        <h2 className="font-display text-2xl">마을에 들어가기</h2>
        <LoginButtons providers={enabledProviders} starters={starters} socialError={socialError} />
      </section>
    </div>
  );
}
