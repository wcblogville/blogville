import type { ReactNode } from "react";
import { TownGame } from "./town-game";
import { TownHud, type TownHudMember } from "./town-hud";
import type { TownData } from "./types";

/**
 * 광장 화면 틀: 게임 + 위에 뜨는 ☰ 메뉴 + 조작 안내. 내 마을(/town)과 다른 회원의 마을(/town/블로그 주소)이 같이 쓴다.
 * 광장은 화면 전체를 쓴다 (헤더 막대 없이 Blogville 글자만 위에 뜬다). 휴대폰(`phone:`)에는 광장이 없어 phone에 넣은 것만 보인다
 */
export function TownScreen({
  data,
  hud,
  startAt,
  openDeco = false,
  phone,
  children,
}: {
  data: TownData;
  hud: TownHudMember | null;
  /** 처음 설 곳 (텔레포트 목록의 key). 없으면 광장 아래쪽 */
  startAt: string | null;
  /** 광장 꾸미기 창을 열고 시작 (?deco=1) */
  openDeco?: boolean;
  /** 휴대폰 화면에 대신 보일 것 */
  phone: ReactNode;
  /** 게임 위에 띄울 것 (환영 문구 등) */
  children?: ReactNode;
}) {
  return (
    <div className="relative h-dvh min-h-[420px] w-full overflow-hidden phone:h-auto phone:min-h-0 phone:overflow-visible phone:pt-14">
      <h1 className="sr-only">{data.host ? `${data.host.nickname}님의 마을` : "중앙 광장"}</h1>
      <TownGame data={data} startAt={startAt} className="h-full w-full phone:hidden" />
      <TownHud data={data} member={hud} openDeco={openDeco} className="phone:hidden" />
      {phone}
      {children}

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
