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

export type TownData = {
  player: { nickname: string; characterAsset: string; outfit: string[] } | null; // null = 로그인하지 않은 방문자
  myHouse: TownHouse | null;
  /** 둘레 집 10자리: 회원은 즐겨찾기한 이웃, 방문자는 인기 블로그 100곳 중 무작위 10곳. 모자라면 빈 집터 */
  neighbors: TownHouse[];
  /** 오늘 출석 일차 (자동 출석, GAME-04 / FR-028). 방문자나 출석 실패면 null */
  attendanceDay: number | null;
};

/** 광장에서 들어가거나 눌렀을 때 일어날 일 */
export type TownTarget =
  | { kind: "link"; href: string }
  | { kind: "login" }
  | { kind: "mailbox"; slot: number }; // 집 앞 우체통 (0 = 내 집)

/** 메뉴의 친구 목록 한 줄: 내가 이웃으로 추가한 사람 */
export type TownFriend = {
  userId: string;
  slug: string;
  title: string;
  nickname: string;
  characterAsset: string;
  isFavorite: boolean;
  /** 공지 블로그(관리자). 마을 둘레에 집이 없어 즐겨찾기(⭐)를 쓰지 않는다 */
  isNotice: boolean;
  /** 상대도 나를 이웃으로 추가했는지 (서로 이웃) */
  followsBack: boolean;
};
