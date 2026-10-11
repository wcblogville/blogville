import { notFound, redirect } from "next/navigation";
import { PhoneHome } from "@/components/town/phone-home";
import { TownScreen } from "@/components/town/town-screen";
import type { TownData } from "@/components/town/types";
import { requireMember } from "@/server/dal";
import { getFavoriteHouses, getHudMember, getMyHouse, getTownHost } from "@/server/town";

export async function generateMetadata(props: PageProps<"/town/[slug]">) {
  const host = await getTownHost((await props.params).slug);
  return { title: host ? `${host.nickname}님의 마을` : "마을" };
}

/**
 * 다른 회원의 마을 구경 (사용자 요청 2026-10-09): 그 회원의 집(0번 자리)과 즐겨찾기 이웃을 본다.
 * 회원만 (방문자는 첫 화면으로), 공지 블로그(관리자)와 없는 주소는 404, 내 주소면 내 마을로.
 * 휴대폰에는 광장이 없어 그 회원의 블로그로 옮긴다
 */
export default async function FriendTownPage(props: PageProps<"/town/[slug]">) {
  const viewer = await requireMember();
  const host = await getTownHost((await props.params).slug);
  if (!host) notFound();
  if (host.userId === viewer.userId) redirect("/town");

  const [house, neighbors, hud] = await Promise.all([
    getMyHouse(host.userId),
    getFavoriteHouses(host.userId),
    getHudMember(viewer.userId, viewer.user.role === "admin", viewer.profile),
  ]);

  const data: TownData = {
    player: { nickname: viewer.profile.nickname, characterAsset: viewer.profile.characterAsset, outfit: viewer.profile.outfit },
    myHouse: house,
    neighbors,
    attendanceDay: viewer.attendance?.cycleDay ?? null,
    host: { nickname: host.nickname, slug: host.slug },
  };

  return (
    <TownScreen
      data={data}
      hud={hud}
      startAt="house:0"
      phone={<PhoneHome href={`/@${host.slug}`} label={`${host.nickname}님의 블로그로 가는 중…`} className="hidden phone:block" />}
    />
  );
}
