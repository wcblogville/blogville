import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { items } from "@/db/schema";
import { CharacterArt } from "@/components/character";
import { LandingScene } from "@/components/landing-scene";
import { LoginButtons } from "@/components/login-buttons";
import { houseIconDataUri, titleDataUri, TITLE_SIZE } from "@/lib/art/landing";
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
    // 도트 마을 풍경 위에 제목·안내(왼쪽)와 로그인 판(오른쪽). 휴대폰·태블릿은 제목 → 마을 → 로그인 판 → 안내 순 (2026-10-11 사용자 요청)
    <div className="relative isolate overflow-hidden lg:min-h-svh">
      <LandingScene />
      <div className="relative mx-auto grid max-w-6xl gap-x-10 px-4 pt-6 pb-10 lg:grid-cols-[1fr_420px] lg:grid-rows-[auto_1fr] lg:items-start lg:pt-14 lg:pb-12">
        <section className="flex flex-col items-center text-center max-lg:min-h-[420px] lg:items-start lg:text-left">
          <p className="pixel-panel inline-flex items-center gap-2 px-3 py-1 text-sm font-bold text-leaf-dark">
            {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
            <img src={houseIconDataUri()} alt="" width={20} height={20} className="pixelated" aria-hidden />
            블로그들이 모여 사는 마을
          </p>
          <h1 className="mt-5 lg:mt-6">
            {/* 제목 글자는 도트 그림 (휴대폰 5배, 넓은 화면 8배) */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
            <img src={titleDataUri(5)} alt="Blogville" width={TITLE_SIZE.w * 5} height={TITLE_SIZE.h * 5} className="pixelated lg:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element -- 코드로 만든 SVG(data URI) */}
            <img src={titleDataUri(8)} alt="Blogville" width={TITLE_SIZE.w * 8} height={TITLE_SIZE.h * 8} className="pixelated max-lg:hidden" />
          </h1>
          <p className="pixel-text mt-5 font-display text-2xl leading-snug sm:text-3xl lg:text-4xl">
            글을 쓸수록 <span className="text-[#ffd36e]">내 마을</span>이 자라요
          </p>
        </section>

        {/* 로그인 판. 휴대폰·태블릿에서는 제목 칸을 420px로 두어 마을 풍경(지평선 300px)과 흙길의 주민이 보인 다음에 나온다 */}
        <section id="login" className="pixel-panel relative mx-auto mt-6 w-full max-w-[420px] scroll-mt-6 px-5 pt-12 pb-6 sm:px-7 lg:row-span-2 lg:mt-0">
          <h2 className="pixel-wood absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-5 py-1.5 font-display text-xl">마을에 들어가기</h2>
          <LoginButtons providers={enabledProviders} starters={starters} socialError={socialError} />
        </section>

        {/* 이장님 말풍선: 게임의 대화 창처럼 */}
        <section className="pixel-panel relative mx-auto mt-14 flex w-full max-w-[420px] gap-4 p-4 lg:mx-0 lg:mt-8 lg:max-w-[540px]">
          <div className="shrink-0 self-start bg-[#f6e0b8] p-1 shadow-[inset_0_0_0_3px_#dcbc8c]">
            <CharacterArt asset="char.dog" size={72} />
          </div>
          <div className="min-w-0 text-left">
            <p className="pixel-wood absolute -top-4 left-4 px-3 py-0.5 font-display text-sm">이장 멍멍이</p>
            <p className="pt-2 pb-3 leading-relaxed text-ink">
              어서 와요! 가입하면 <b>내 블로그가 곧 내 집</b>이 돼요. 문을 열고 나가면 이웃들이 사는 마을이 나와요.
              글을 쓰고 출석하면 🪙 코인과 경험치가 쌓이고, 옷·가구·동물로 집을 꾸밀 수 있어요.
            </p>
            <span className="absolute right-4 bottom-1.5 text-xs text-ink-soft motion-safe:animate-[blink_1s_steps(1)_infinite]" aria-hidden>
              ▼
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
