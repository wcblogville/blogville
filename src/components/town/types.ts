export type TownHouse = {
  slug: string;
  title: string;
  nickname: string;
  characterAsset: string;
  /** 주인이 입은 아바타 아이템 (SHOP-06) */
  outfit: string[];
  /** 지붕 색 (hex). 고른 색, 안 골랐으면 가입 때 받은 무작위 색 (TOWN-07) */
  roof: string;
  /** 집 주인 레벨 → 집 단계 (TOWN-11) */
  level: number;
  /** 우체통에서 보는 최근 공개 글 (최대 3개) */
  recentPosts: { id: number; title: string }[];
};

/** 마을에 집이 선 이웃 (집 자리 번호 lot 1~10) */
export type TownNeighbor = TownHouse & { lot: number };

export type TownData = {
  player: { nickname: string; characterAsset: string; outfit: string[] } | null; // null = 로그인하지 않은 방문자
  myHouse: TownHouse | null;
  /**
   * 이웃 집 10자리: 회원은 즐겨찾기한 이웃, 방문자는 인기 블로그 100곳 중 무작위 10곳. 모자라면 빈 집터.
   * lot = 집 자리 번호(1~10, layout.ts HOUSE_LOTS). 회원이 고른 자리, 안 고른 이웃은 남은 자리를 차례로 (TOWN-18)
   */
  neighbors: TownNeighbor[];
  /** 오늘 출석 일차 (자동 출석, GAME-04 / FR-028). 방문자나 출석 실패면 null */
  attendanceDay: number | null;
  /**
   * 다른 회원의 마을을 구경하는 중이면 그 주인 (/town/블로그 주소, 사용자 요청 2026-10-09). 내 마을·방문자 광장이면 null.
   * 구경할 때는 myHouse(0번 집)가 주인의 집이고, neighbors가 주인이 즐겨찾기한 이웃이다
   */
  host: { nickname: string; slug: string } | null;
};

/** 광장에서 들어가거나 눌렀을 때 일어날 일 */
export type TownTarget =
  | { kind: "link"; href: string }
  | { kind: "login" }
  | { kind: "mailbox"; slot: number } // 집 앞 우체통 (0 = 내 집)
  | { kind: "lot"; slot: number }; // 빈 집터 (내 마을): 이웃 집 자리 고르기 창을 연다 (TOWN-18)

/** 메뉴의 친구 목록 한 줄: 내가 이웃으로 추가한 사람 */
export type TownFriend = {
  userId: string;
  slug: string;
  title: string;
  nickname: string;
  characterAsset: string;
  isFavorite: boolean;
  /** 공지 블로그(관리자). 마을에 집이 없어 즐겨찾기(⭐)를 쓰지 않는다 */
  isNotice: boolean;
  /** 상대도 나를 이웃으로 추가했는지 (서로 이웃) */
  followsBack: boolean;
  /** 내가 골라 준 집 자리 (1~10). 안 골랐으면 null (TOWN-18) */
  townLot: number | null;
};
