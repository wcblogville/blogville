export type TownHouse = {
  slug: string;
  title: string;
  nickname: string;
  characterAsset: string;
  backgroundAsset: string;
};

export type TownData = {
  player: { nickname: string; characterAsset: string } | null; // null = 로그인하지 않은 방문자
  myHouse: TownHouse | null;
  neighbors: TownHouse[];
  /** 오늘 출석 일차 (자동 출석, GAME-04 / FR-028). 방문자나 출석 실패면 null */
  attendanceDay: number | null;
};

/** 광장 건물을 눌렀을 때 이동할 곳 */
export type TownTarget =
  | { kind: "link"; href: string }
  | { kind: "login" };
