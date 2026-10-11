// 광장 배치 (Phaser 없이 쓰는 순수 계산). 장면(scene.ts)과 메뉴의 텔레포트 목록이 같은 좌표를 쓴다.
// 가운데 타운(분수·게시판·상점·낚시터, 농장은 내 집 옆)을 집 11채가 원형으로 둘러싼다. 0번 자리(맨 아래)가 내 집.
import type { TownData, TownHouse } from "./types";

export const WORLD = { width: 2600, height: 2600 };
export const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };
/** 가운데 돌광장 반지름 */
export const PLAZA_RADIUS = 250;
/** 타운(건물들이 있는 잔디 원) 반지름. 미용실·옷가게가 들어오도록 560에서 넓혔다 (2026-10-11) */
export const TOWN_RADIUS = 640;
/** 집들을 잇는 둘레 길 반지름 */
export const RING_RADIUS = 860;
/** 집이 놓이는 원 반지름 (아랫변 기준) */
export const HOUSE_RADIUS = 1010;
export const HOUSE_SLOTS = 11;

export const BOARD_POS = { x: CENTER.x, y: CENTER.y - PLAZA_RADIUS - 110 };
export const SHOP_POS = { x: CENTER.x + 400, y: CENTER.y + 60 };
/** 동물 농장: 내 집(맨 아래 0번 자리)에서 가장 가까운 곳, 내 집 길 오른쪽 (사용자 요청 2026-10-08) */
export const FARM_POS = { x: CENTER.x + 190, y: CENTER.y + 690 };
/** 처음 서는 곳 (광장 아래쪽). 정류장은 없앴다: 텔레포트는 ☰ 메뉴로 (사용자 요청 2026-10-08) */
export const START_POS = { x: CENTER.x + 50, y: CENTER.y + PLAZA_RADIUS + 100 };
/** 연못 낚시터: 광장 왼쪽, 상점 맞은편 (원래 농장 자리, 사용자 요청 2026-10-08) */
export const FISHING_POS = { x: CENTER.x - 410, y: CENTER.y + 90 };
export const POND_POS = { x: CENTER.x - 250, y: CENTER.y + 400 };
/** 미용실·옷가게 (사용자 요청 2026-10-11): 게시판 양옆 위쪽, 타운 잔디 끝에 마주 보고 선다 (왼쪽 미용실, 오른쪽 옷가게) */
export const SALON_POS = { x: CENTER.x - 560, y: CENTER.y - 190 };
export const CLOTHES_POS = { x: CENTER.x + 560, y: CENTER.y - 190 };

/**
 * 광장 꾸미기 자리 (장식의 아랫변 가운데, 사용자 요청 2026-10-09). 앞 번호부터 집 단계만큼 열린다 (4/6/8, lib/house.ts decorationSlots).
 * 분수 양옆, 광장 아래, 그리고 집으로 가는 길 사이사이 잔디. 건물·길·연못과 겹치지 않는 곳이다
 */
export const DECO_SLOTS = [
  { x: CENTER.x - 165, y: CENTER.y + 45 },
  { x: CENTER.x + 165, y: CENTER.y + 45 },
  { x: CENTER.x + 120, y: CENTER.y + 400 },
  { x: CENTER.x - 350, y: CENTER.y + 300 },
  { x: CENTER.x - 227, y: CENTER.y - 354 },
  { x: CENTER.x + 227, y: CENTER.y - 354 },
  { x: CENTER.x - 382, y: CENTER.y - 174 },
  { x: CENTER.x + 317, y: CENTER.y + 275 },
] as const;

/** 광장 화면 주소: 내 마을(/town)과 다른 회원의 마을(/town/블로그 주소). 헤더·푸터가 광장 모양으로 바뀐다 */
export function isTownPath(pathname: string) {
  return pathname === "/town" || pathname.startsWith("/town/");
}

/** i번 집 자리 (아랫변 가운데). 0번이 맨 아래, 시계 방향 */
export function houseSlot(i: number) {
  const angle = Math.PI / 2 + (i * 2 * Math.PI) / HOUSE_SLOTS;
  return { x: Math.round(CENTER.x + Math.cos(angle) * HOUSE_RADIUS), y: Math.round(CENTER.y + Math.sin(angle) * HOUSE_RADIUS), angle };
}

/** i번 자리의 집 (0 = 내 집, 1~10 = 이웃집). 없으면 null = 빈 집터 */
export function houseAt(data: TownData, i: number): TownHouse | null {
  return i === 0 ? data.myHouse : (data.neighbors[i - 1] ?? null);
}

export type TownSpot = { key: string; label: string; emoji: string; x: number; y: number; href: string | null; empty?: boolean };

/** 텔레포트할 수 있는 곳. 좌표는 캐릭터가 설 자리(문 앞). decos는 광장 꾸미기 창이 자리를 고를 때만 쓴다 (텔레포트 목록에는 없다) */
export function townSpots(data: TownData): { places: TownSpot[]; houses: TownSpot[]; decos: TownSpot[] } {
  const places: TownSpot[] = [
    { key: "plaza", label: "광장 분수", emoji: "⛲", x: CENTER.x, y: CENTER.y + 140, href: "/town" },
    { key: "board", label: "마을 게시판", emoji: "📋", x: BOARD_POS.x, y: BOARD_POS.y + 40, href: "/feed" },
    { key: "shop", label: "상점", emoji: "🏪", x: SHOP_POS.x + 40, y: SHOP_POS.y + 40, href: "/shop" },
    { key: "farm", label: "동물 농장", emoji: "🐮", x: FARM_POS.x, y: FARM_POS.y + 40, href: "/farm" },
    { key: "fishing", label: "낚시터", emoji: "🎣", x: FISHING_POS.x + 40, y: FISHING_POS.y + 40, href: "/fishing" },
    { key: "salon", label: "미용실", emoji: "💇", x: SALON_POS.x + 30, y: SALON_POS.y + 40, href: "/salon" },
    { key: "clothes", label: "옷가게", emoji: "👗", x: CLOTHES_POS.x + 30, y: CLOTHES_POS.y + 40, href: "/clothes" },
  ];
  const houses: TownSpot[] = [];
  for (let i = 0; i < HOUSE_SLOTS; i++) {
    const h = houseAt(data, i);
    const p = houseSlot(i);
    // 다른 회원의 마을(host)에서는 0번 집도 그 주인의 집이다
    const label = i === 0 && !data.host ? (h ? "내 집" : "내 집 자리") : h ? `${h.nickname}의 집` : "빈 집터";
    houses.push({ key: `house:${i}`, label, emoji: h ? "🏠" : "🪧", x: p.x, y: p.y + 46, href: h ? `/@${h.slug}` : null, empty: !h });
  }
  // 장식 앞(아래쪽)에 선다
  const decos: TownSpot[] = DECO_SLOTS.map((p, i) => ({ key: `deco:${i}`, label: `꾸미기 ${i + 1}번 자리`, emoji: "🌷", x: p.x, y: p.y + 40, href: null }));
  return { places, houses, decos };
}
