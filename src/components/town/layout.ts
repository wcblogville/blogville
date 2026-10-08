// 광장 배치 (Phaser 없이 쓰는 순수 계산). 장면(scene.ts)과 메뉴의 텔레포트 목록이 같은 좌표를 쓴다.
// 가운데 타운(분수·게시판·상점·농장)을 집 11채가 원형으로 둘러싼다. 0번 자리(맨 아래)가 내 집.
import type { TownData, TownHouse } from "./types";

export const WORLD = { width: 2600, height: 2600 };
export const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };
/** 가운데 돌광장 반지름 */
export const PLAZA_RADIUS = 250;
/** 타운(건물들이 있는 잔디 원) 반지름 */
export const TOWN_RADIUS = 560;
/** 집들을 잇는 둘레 길 반지름 */
export const RING_RADIUS = 860;
/** 집이 놓이는 원 반지름 (아랫변 기준) */
export const HOUSE_RADIUS = 1010;
export const HOUSE_SLOTS = 11;

export const BOARD_POS = { x: CENTER.x, y: CENTER.y - PLAZA_RADIUS - 110 };
export const SHOP_POS = { x: CENTER.x + 400, y: CENTER.y + 60 };
export const FARM_POS = { x: CENTER.x - 410, y: CENTER.y + 90 };
/** 처음 서는 곳 (광장 아래쪽). 정류장은 없앴다: 텔레포트는 ☰ 메뉴로 (사용자 요청 2026-10-08) */
export const START_POS = { x: CENTER.x + 50, y: CENTER.y + PLAZA_RADIUS + 100 };
export const POND_POS = { x: CENTER.x - 250, y: CENTER.y + 400 };

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

/** 텔레포트할 수 있는 곳. 좌표는 캐릭터가 설 자리(문 앞) */
export function townSpots(data: TownData): { places: TownSpot[]; houses: TownSpot[] } {
  const places: TownSpot[] = [
    { key: "plaza", label: "광장 분수", emoji: "⛲", x: CENTER.x, y: CENTER.y + 140, href: "/town" },
    { key: "board", label: "마을 게시판", emoji: "📋", x: BOARD_POS.x, y: BOARD_POS.y + 40, href: "/feed" },
    { key: "shop", label: "상점", emoji: "🏪", x: SHOP_POS.x + 40, y: SHOP_POS.y + 40, href: "/shop" },
    { key: "farm", label: "동물 농장", emoji: "🐮", x: FARM_POS.x, y: FARM_POS.y + 40, href: "/farm" },
  ];
  const houses: TownSpot[] = [];
  for (let i = 0; i < HOUSE_SLOTS; i++) {
    const h = houseAt(data, i);
    const p = houseSlot(i);
    const label = i === 0 ? (h ? "내 집" : "내 집 자리") : h ? `${h.nickname}의 집` : "빈 집터";
    houses.push({ key: `house:${i}`, label, emoji: h ? "🏠" : "🪧", x: p.x, y: p.y + 46, href: h ? `/@${h.slug}` : null, empty: !h });
  }
  return { places, houses };
}
