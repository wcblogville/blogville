import { redirect } from "next/navigation";
import { LoginButtons } from "@/components/login-buttons";
import { enabledProviders } from "@/lib/auth";
import { getViewer } from "@/server/dal";

export default async function LandingPage() {
  const viewer = await getViewer();
  if (viewer) redirect(viewer.profile ? "/town" : "/onboarding");

  return (
    <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
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
          캐릭터를 골라 광장에 도착하면, 그곳에 내 블로그 집이 생겨요.
          <br />
          글을 쓰고 출석하면 코인과 경험치가 쌓이고, 새 캐릭터와 배경으로 블로그를 꾸밀 수 있어요.
        </p>
        <ul className="mt-6 grid grid-cols-3 gap-3 text-center text-sm font-bold">
          <li className="card p-3">✏️<br />글쓰기</li>
          <li className="card p-3">🪙<br />보상</li>
          <li className="card p-3">🎨<br />꾸미기</li>
        </ul>
      </section>

      <section className="card flex flex-col items-center gap-6 p-8">
        <div className="text-7xl" aria-hidden>
          🧑🐱🐶
        </div>
        <h2 className="font-display text-2xl">마을에 들어가기</h2>
        <LoginButtons providers={enabledProviders} />
      </section>
    </div>
  );
}
