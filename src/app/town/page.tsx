import Link from "next/link";
import { TownGame } from "@/components/town/town-game";
import { TownHud, type TownHudMember } from "@/components/town/town-hud";
import { TownMenu } from "@/components/town/town-menu";
import type { TownData } from "@/components/town/types";
import { getViewer } from "@/server/dal";
import { getHeaderNotifications, listNotifications } from "@/server/notifications";
import { getWallet } from "@/server/points";
import { getFavoriteHouses, getFriends, getMyHouse, getTownHouses } from "@/server/town";

/** 메뉴 알림 창에 보여 줄 최근 알림 수 */
const MENU_NOTIFICATIONS = 5;

export const metadata = { title: "중앙 광장" };

export default async function TownPage(props: PageProps<"/town">) {
  const viewer = await getViewer();
  const member = viewer?.profile ? viewer : null;
  const { welcome } = await props.searchParams;

  // 둘레 집 10자리: 회원은 즐겨찾기한 이웃, 방문자는 최근 글이 있는 블로그
  const [neighbors, myHouse, hud] = await Promise.all([
    member ? getFavoriteHouses(member.userId) : getTownHouses(null),
    member ? getMyHouse(member.userId) : null,
    member ? getHudMember(member.userId) : null,
  ]);

  const data: TownData = {
    player: member?.profile
      ? { nickname: member.profile.nickname, characterAsset: member.profile.characterAsset }
      : null,
    myHouse,
    neighbors,
    attendanceDay: member?.attendance?.cycleDay ?? null,
  };

  // 광장은 헤더 아래 화면 전체를 쓴다. 안내·환영·이웃집은 게임 위에 띄운다.
  // 휴대폰에서는 광장 대신 간단 메뉴만 보여준다 (10/6 회의 결정, `phone:` = 휴대폰 화면)
  return (
    <div className="relative h-[calc(100dvh-var(--header-h))] min-h-[420px] w-full overflow-hidden phone:h-auto phone:min-h-0 phone:overflow-visible">
      <h1 className="sr-only">중앙 광장</h1>
      {/* 처음 온 회원은 내 집 앞에서 시작한다 */}
      <TownGame data={data} startAt={welcome && member ? "house:0" : null} className="h-full w-full phone:hidden" />
      <TownHud data={data} member={hud} className="phone:hidden" />
      <TownMenu data={data} member={hud} welcome={Boolean(welcome)} className="hidden phone:block" />

      {welcome && member?.profile && (
        <div className="card absolute inset-x-3 bottom-14 z-10 mx-auto flex max-w-2xl items-start gap-3 border-sun bg-[#fff3d6] p-4 phone:hidden">
          <span className="text-3xl">🎉</span>
          <p className="flex-1 text-sm sm:text-base">
            <b>{member.profile.nickname}</b>님, Blogville에 오신 걸 환영해요! 가입 선물로 🪙 100 코인을 드렸어요.
            눈앞의 <b>내 집</b>에 들어가서 첫 글을 써 보세요. 왼쪽 위 <b>☰ 메뉴</b>에서 내 프로필·알림·텔레포트·친구 목록을 볼 수 있어요.
            마을 가운데 <b>🚏 정류장</b>에서는 즐겨찾기한 이웃의 집으로 바로 갈 수 있어요.
          </p>
          <Link href="/town" className="shrink-0 rounded-lg px-2 py-1 text-ink-soft hover:bg-white" aria-label="환영 문구 닫기">
            ✕
          </Link>
        </div>
      )}

      {/* 기기에 맞는 조작 안내: 마우스·키보드 / 터치 (TOWN-02) */}
      <p className="pointer-events-none absolute bottom-3 right-3 z-[5] rounded-full bg-white/85 px-3 py-1.5 text-xs text-ink-soft shadow-sm pointer-coarse:hidden phone:hidden">
        방향키·WASD 또는 클릭으로 이동 · 건물 앞에서 <kbd className="rounded bg-cream px-1.5">Space</kbd>로 들어가기
      </p>
      <p className="pointer-events-none absolute bottom-3 right-3 z-[5] hidden max-w-[55%] rounded-2xl bg-white/85 px-3 py-1.5 text-xs text-ink-soft shadow-sm pointer-coarse:block phone:hidden">
        조이스틱이나 탭으로 이동 · 건물을 탭해서 들어가기
      </p>
    </div>
  );
}

async function getHudMember(userId: string): Promise<TownHudMember> {
  const [wallet, header, list, friends] = await Promise.all([
    getWallet(userId),
    getHeaderNotifications(userId),
    listNotifications(userId, 1),
    getFriends(userId),
  ]);
  return {
    wallet: { coins: wallet.coins, level: wallet.level, current: wallet.current, needed: wallet.needed, isMax: wallet.isMax },
    unread: header.unread,
    notifications: list.rows.slice(0, MENU_NOTIFICATIONS),
    friends,
  };
}
