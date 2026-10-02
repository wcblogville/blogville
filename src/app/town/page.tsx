import Link from "next/link";
import { redirect } from "next/navigation";
import { TownGame } from "@/components/town/town-game";
import type { TownData } from "@/components/town/types";
import { getViewer } from "@/server/dal";
import { getMyHouse, getTownHouses, hasAttendedToday } from "@/server/town";

export const metadata = { title: "중앙 광장" };

export default async function TownPage(props: PageProps<"/town">) {
  const viewer = await getViewer();
  if (viewer && !viewer.profile) redirect("/onboarding");
  const member = viewer?.profile ? viewer : null;
  const { welcome } = await props.searchParams;

  const [neighbors, myHouse, attendedToday] = await Promise.all([
    getTownHouses(member?.userId ?? null),
    member ? getMyHouse(member.userId) : null,
    member ? hasAttendedToday(member.userId) : false,
  ]);

  const data: TownData = {
    player: member?.profile
      ? { nickname: member.profile.nickname, characterAsset: member.profile.characterAsset }
      : null,
    myHouse,
    neighbors,
    attendedToday,
  };

  // 광장은 헤더 아래 화면 전체를 쓴다. 안내·환영·이웃집은 게임 위에 띄운다
  return (
    <div className="relative h-[calc(100dvh-var(--header-h))] min-h-[420px] w-full overflow-hidden">
      <h1 className="sr-only">중앙 광장</h1>
      <TownGame data={data} className="h-full w-full" />

      {welcome && member?.profile && (
        <div className="card absolute inset-x-3 top-3 z-10 mx-auto flex max-w-2xl items-start gap-3 border-sun bg-[#fff3d6] p-4">
          <span className="text-3xl">🎉</span>
          <p className="flex-1 text-sm sm:text-base">
            <b>{member.profile.nickname}</b>님, Blogville에 오신 걸 환영해요! 가입 선물로 🪙 100 코인을 드렸어요.
            광장 아래쪽 <b>내 집</b>에 들어가서 첫 글을 써 보세요. 위쪽 <b>게시판</b>에서 출석 도장도 받을 수 있어요. 왼쪽 <b>동물 농장</b>은 곧 문을 열어요.
          </p>
          <Link href="/town" className="shrink-0 rounded-lg px-2 py-1 text-ink-soft hover:bg-white" aria-label="환영 문구 닫기">
            ✕
          </Link>
        </div>
      )}

      {/* 이웃집 목록: 광장에서 못 찾은 블로그도 여기서 들어갈 수 있다 (TOWN-04) */}
      {neighbors.length > 0 && (
        <section className="absolute left-3 top-3 z-[5] max-w-[calc(100%-1.5rem)] sm:max-w-xs">
          <details open className="group rounded-2xl bg-white/90 shadow-md backdrop-blur">
            <summary className="cursor-pointer list-none px-3 py-2 font-display text-lg">
              🏘 이웃집 <span className="text-sm text-ink-soft">{neighbors.length}</span>
              <span className="float-right text-sm text-ink-soft group-open:rotate-180">▾</span>
            </summary>
            <ul className="max-h-[40dvh] space-y-1 overflow-y-auto px-2 pb-2">
              {neighbors.map((h) => (
                <li key={h.slug}>
                  <Link href={`/@${h.slug}`} className="block truncate rounded-lg px-2 py-1.5 text-sm hover:bg-cream hover:text-leaf-dark">
                    {h.title} <span className="text-ink-soft">· {h.nickname}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {/* 기기에 맞는 조작 안내: 마우스·키보드 / 터치 (TOWN-02) */}
      <p className="pointer-events-none absolute bottom-3 right-3 z-[5] rounded-full bg-white/85 px-3 py-1.5 text-xs text-ink-soft shadow-sm pointer-coarse:hidden">
        방향키·WASD 또는 클릭으로 이동 · 건물 앞에서 <kbd className="rounded bg-cream px-1.5">Space</kbd>로 들어가기
      </p>
      <p className="pointer-events-none absolute bottom-3 right-3 z-[5] hidden max-w-[55%] rounded-2xl bg-white/85 px-3 py-1.5 text-xs text-ink-soft shadow-sm pointer-coarse:block">
        조이스틱이나 탭으로 이동 · 건물을 탭해서 들어가기
      </p>
    </div>
  );
}
