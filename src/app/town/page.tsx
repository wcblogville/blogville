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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {welcome && member?.profile && (
        <div className="card mb-4 flex items-center gap-3 border-sun bg-[#fff3d6] p-4">
          <span className="text-3xl">🎉</span>
          <p>
            <b>{member.profile.nickname}</b>님, Blogville에 오신 걸 환영해요! 가입 선물로 🪙 100 코인을 드렸어요.
            광장 아래쪽 <b>내 집</b>에 들어가서 첫 글을 써 보세요. 위쪽 <b>게시판</b>에서 출석 도장도 받을 수 있어요. 왼쪽 <b>동물 농장</b>은 곧 문을 열어요.
          </p>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-3xl">🏛 중앙 광장</h1>
        {/* 기기에 맞는 조작 안내: 마우스·키보드 / 터치 (TOWN-02) */}
        <p className="text-sm text-ink-soft pointer-coarse:hidden">
          방향키·WASD 또는 클릭으로 이동 · 건물 앞에서 <kbd className="rounded bg-white px-1.5 shadow-sm">Space</kbd>로 들어가기
        </p>
        <p className="hidden text-sm text-ink-soft pointer-coarse:block">
          왼쪽 아래 조이스틱이나 탭으로 이동 · 건물을 탭해서 들어가기
        </p>
      </div>

      <TownGame data={data} />

      {neighbors.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-xl">🏘 이웃집</h2>
          <ul className="flex flex-wrap gap-2">
            {neighbors.map((h) => (
              <li key={h.slug}>
                <Link href={`/@${h.slug}`} className="inline-block rounded-full bg-white px-3 py-1.5 text-sm shadow-sm hover:text-leaf-dark">
                  {h.title} <span className="text-ink-soft">· {h.nickname}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
