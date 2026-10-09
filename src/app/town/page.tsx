import Link from "next/link";
import { DropSearchParam } from "@/components/drop-search-param";
import { PhoneHome } from "@/components/town/phone-home";
import { TownMenu } from "@/components/town/town-menu";
import { TownScreen } from "@/components/town/town-screen";
import type { TownData } from "@/components/town/types";
import { decorationSlots } from "@/lib/house";
import { getViewer } from "@/server/dal";
import { getDecorations, getFavoriteHouses, getGuestHouses, getHudMember, getMyHouse } from "@/server/town";

export const metadata = { title: "중앙 광장" };

export default async function TownPage(props: PageProps<"/town">) {
  const viewer = await getViewer();
  const member = viewer?.profile ? viewer : null;
  const { welcome, at, menu, deco } = await props.searchParams;

  // 둘레 집 10자리: 회원은 즐겨찾기한 이웃, 방문자는 인기 블로그 100곳 중 무작위 10곳
  const [neighbors, myHouse, hud, decorations] = await Promise.all([
    member ? getFavoriteHouses(member.userId) : getGuestHouses(),
    member ? getMyHouse(member.userId) : null,
    member ? getHudMember(member.userId, member.user.role === "admin", member.profile) : null,
    member ? getDecorations(member.userId) : [],
  ]);

  const data: TownData = {
    player: member?.profile
      ? { nickname: member.profile.nickname, characterAsset: member.profile.characterAsset, outfit: member.profile.outfit }
      : null,
    myHouse,
    neighbors,
    attendanceDay: member?.attendance?.cycleDay ?? null,
    host: null,
    decorations,
    decoSlots: myHouse ? decorationSlots(myHouse.level) : 0,
  };

  // 안내·환영·이웃집은 게임 위에 띄운다.
  // 휴대폰(`phone:`)에는 광장이 없다 (사용자 결정 2026-10-09): 회원은 내 블로그로 옮기고, 아래 탭의 ☰ 메뉴(?menu=1)와 방문자는 간단 메뉴
  return (
    <TownScreen
      data={data}
      hud={hud}
      // 집의 🚪 문으로 나오면(?at=블로그 주소) 그 집 앞에서, 처음 온 회원은 내 집 앞에서 시작한다
      startAt={startAt(data, welcome && member ? myHouse?.slug : at)}
      openDeco={Boolean(deco)}
      phone={
        member && !menu ? (
          <PhoneHome href={`/@${member.profile.blogSlug}`} className="hidden phone:block" />
        ) : (
          <TownMenu data={data} member={hud} className="hidden phone:block" />
        )
      }
    >
      {/* 환영은 한 번만: 보여 준 뒤 주소에서 ?welcome을 지워 새로고침하면 다시 뜨지 않게 (TOWN-01 / SC-002) */}
      {welcome && <DropSearchParam name="welcome" />}

      {welcome && member?.profile && (
        <div className="card absolute inset-x-3 bottom-14 z-10 mx-auto flex max-w-2xl items-start gap-3 border-sun bg-[#fff3d6] p-4 phone:hidden">
          <span className="text-3xl">🎉</span>
          <p className="flex-1 text-sm sm:text-base">
            <b>{member.profile.nickname}</b>님, 마을에 처음 나왔어요! 뒤에 있는 <b>내 집</b>에 다시 들어가면 글을 쓸 수 있어요. 왼쪽 위 <b>☰ 메뉴</b>의 텔레포트로 즐겨찾기한 이웃 집에 바로 갈 수 있고, 프로필·알림·친구 목록도 볼 수 있어요.
          </p>
          <Link href="/town" className="shrink-0 rounded-lg px-2 py-1 text-ink-soft hover:bg-white" aria-label="환영 문구 닫기">
            ✕
          </Link>
        </div>
      )}
    </TownScreen>
  );
}

/** 블로그 주소 → 그 집의 텔레포트 key (마을 둘레에 없는 집이면 null = 광장 아래쪽) */
function startAt(data: TownData, slug: string | string[] | undefined): string | null {
  if (typeof slug !== "string") return null;
  if (data.myHouse?.slug === slug) return "house:0";
  const i = data.neighbors.findIndex((h) => h.slug === slug);
  return i >= 0 ? `house:${i + 1}` : null;
}
