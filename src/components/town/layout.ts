// 광장 배치 (Phaser 없이 쓰는 순수 계산). 장면(scene.ts)·바닥(ground.ts)·땅 높이(terrain.ts)·메뉴의 텔레포트 목록이 같은 좌표를 쓴다.
// 2.5D 마을 (사용자 요청 2026-10-11 "2.5d로, 높낮이도", "시계 모양 말고 자연스럽게"):
// - 가운데 단(높이 1)에 게시판·상점·미용실·옷가게·낚시터·연못, 그 가운데 한 단 높은 돌광장(높이 2)과 분수가 있다.
// - 북쪽은 한 단 높은 언덕(높이 2), 그 왼쪽 위에 한 단 더 높은 전망대(높이 3), 동쪽에 작은 둔덕(높이 2), 남쪽은 한 단 낮은 들판(높이 0).
// - 단과 단 사이는 절벽(앞면이 보이는 돌벽)이고 길이 지나가는 곳만 계단이다. 연못은 땅보다 낮게 파여 있다.
// - 집 11채가 길을 따라 여기저기 서 있다. 0번이 내 집(남쪽 들판, 옆에 동물 농장).
import type { TownData, TownHouse } from "./types";

export const WORLD = { width: 2600, height: 2600 };
export const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };
/** 가운데 돌광장 반지름 */
export const PLAZA_RADIUS = 250;
/** 맨 위 먼 풍경(하늘·먼 산·먼 숲) 높이. 걸어 들어갈 수 없다 */
export const HORIZON = 150;
/** 땅 한 단의 높이 (절벽 앞면이 화면에서 차지하는 px). 도트 16칸 × PIXEL(3) */
export const LEVEL_HEIGHT = 48;
/** 연못 둑 높이 (물이 땅보다 낮다) */
export const BANK_HEIGHT = 18;
/** 가장자리 숲 띠 두께 (나무가 빽빽해 걸어 들어갈 수 없다) */
export const FOREST_EDGE = 90;

/**
 * 절벽 줄: x마다 경계의 y (점 사이는 곧게 잇고 terrain.ts가 살짝 구불구불하게 흔든다).
 * north: 이 줄보다 위(북쪽)가 언덕(높이 2), south: 이 줄보다 아래(남쪽)가 들판(높이 0)
 */
export const CLIFF_LINES = {
  north: [[0, 720], [300, 715], [600, 700], [900, 690], [1150, 690], [1300, 680], [1500, 690], [1800, 690], [2100, 700], [2400, 720], [2600, 725]],
  south: [[0, 1850], [300, 1870], [600, 1840], [900, 1870], [1150, 1890], [1300, 1890], [1500, 1895], [1800, 1880], [2050, 1920], [2300, 1960], [2600, 1950]],
} as const satisfies Record<string, readonly (readonly [number, number])[]>;

/** 둥근 단: 그 안은 정한 높이 (언덕 위 전망대, 동쪽 둔덕). 가장자리는 terrain.ts가 흔든다 */
export const MESAS = [
  { key: "lookout", x: 430, y: 400, rx: 235, ry: 140, level: 3 },
  { key: "knoll", x: 2290, y: 1340, rx: 220, ry: 160, level: 2 },
] as const;

/** 낚시 연못 (땅보다 낮은 물). 가운데와 반지름 */
export const POND = { x: CENTER.x - 250, y: CENTER.y + 400, rx: 125, ry: 75 };
export const POND_POS = { x: POND.x, y: POND.y };

export const BOARD_POS = { x: CENTER.x, y: CENTER.y - PLAZA_RADIUS - 110 };
export const SHOP_POS = { x: CENTER.x + 400, y: CENTER.y + 60 };
export const FISHING_POS = { x: CENTER.x - 410, y: CENTER.y + 90 };
/** 미용실·옷가게 (사용자 요청 2026-10-11): 게시판 양옆 위쪽 (왼쪽 미용실, 오른쪽 옷가게) */
export const SALON_POS = { x: CENTER.x - 560, y: CENTER.y - 190 };
export const CLOTHES_POS = { x: CENTER.x + 560, y: CENTER.y - 190 };

/**
 * 집 자리 11곳 (아랫변 가운데). 0번 = 내 집 (남쪽 들판), 1~10번 = 즐겨찾기 이웃이 고른 자리 (TOWN-04·18).
 * 언덕(1·2·4), 전망대(3), 동쪽 둔덕(5), 가운데 단(6·10), 남쪽 들판(0·7·8·9)
 */
export const HOUSE_LOTS = [
  { x: 1110, y: 2280 },
  { x: 1000, y: 520 },
  { x: 1620, y: 500 },
  { x: 430, y: 420 },
  { x: 2150, y: 470 },
  { x: 2290, y: 1390 },
  { x: 300, y: 1150 },
  { x: 520, y: 2280 },
  { x: 810, y: 2280 },
  { x: 1900, y: 2280 },
  { x: 2330, y: 1820 },
] as const;
export const HOUSE_SLOTS = HOUSE_LOTS.length;
/** 집 자리가 있는 곳 (이웃 집 자리 고르기 창에 보인다) */
export const LOT_AREAS = ["남쪽 들판", "언덕", "언덕", "언덕 위 전망대", "언덕 동쪽", "동쪽 둔덕", "서쪽 마을", "남쪽 들판 서쪽", "남쪽 들판", "남쪽 들판 동쪽", "동쪽 계단 옆"] as const;
/** 동물 농장: 내 집(0번) 오른쪽, 큰길 건너 */
export const FARM_POS = { x: 1500, y: 2290 };
/** 처음 서는 곳 (광장 아래쪽) */
export const START_POS = { x: CENTER.x + 50, y: CENTER.y + PLAZA_RADIUS + 100 };

/** 광장 둘레 문: 길이 돌광장에 닿는 점 (각도, 0 = 동쪽, 90 = 남쪽). 사람(NPC)이 광장 안을 도는 고리도 이 점들을 지난다 */
export function plazaGate(deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Math.round(CENTER.x + Math.cos(a) * 205), Math.round(CENTER.y + Math.sin(a) * 205)];
}

export type PathKind = "stone" | "dirt" | "plaza";
/**
 * 길 (꺾은선). stone = 광장에서 나가는 큰 돌길, dirt = 모래 흙길, plaza = 돌광장 안의 고리(그리지 않고 사람이 걷는 길로만 쓴다).
 * 갈림길은 같은 좌표를 공유한다 (사람이 걷는 길 그래프가 이어진다). 길이 단 경계를 지나는 곳이 계단이 된다
 */
export const PATHS: { kind: PathKind; width: number; points: (readonly [number, number])[] }[] = [
  // 돌광장 안 고리 (10도마다)
  { kind: "plaza", width: 40, points: [...Array.from({ length: 36 }, (_, i) => plazaGate(-180 + i * 10)), plazaGate(-180)] },
  // 북쪽 큰길: 광장 → 게시판 왼쪽 → 계단 → 언덕 길
  { kind: "stone", width: 54, points: [plazaGate(-120), [1150, 1010], [1120, 900], [1130, 790], [1150, 690], [1170, 620], [1180, 570]] },
  // 게시판 앞 작은 길
  { kind: "dirt", width: 40, points: [[1150, 1010], [1300, 990]] },
  // 언덕 길: 전망대 계단 아래 → 언덕 집들 → 동쪽 끝
  { kind: "dirt", width: 46, points: [[440, 640], [600, 625], [800, 600], [1000, 575], [1180, 570], [1400, 580], [1620, 560], [1880, 565], [2100, 560], [2150, 520]] },
  // 전망대 계단 → 3번 집
  { kind: "dirt", width: 42, points: [[440, 640], [435, 540], [430, 470]] },
  // 언덕에서 서쪽으로 내려와 미용실 앞까지
  { kind: "dirt", width: 42, points: [[600, 625], [560, 720], [525, 830], [560, 950], [615, 1060], [640, 1165], [700, 1165]] },
  // 미용실 길: 광장 → 미용실 → 6번 집
  { kind: "stone", width: 50, points: [plazaGate(-160), [960, 1180], [800, 1165], [700, 1165], [500, 1210], [300, 1196]] },
  // 낚시터 길: 광장 → 낚시터 → 서남쪽 계단 → 들판
  { kind: "stone", width: 50, points: [plazaGate(160), [1000, 1430], [900, 1440]] },
  { kind: "dirt", width: 42, points: [[900, 1440], [740, 1490], [560, 1540], [410, 1640], [335, 1780], [320, 1910], [280, 2060], [255, 2200], [300, 2330]] },
  // 남쪽 큰길: 광장 → 계단 → 들판 큰 갈림길
  { kind: "stone", width: 54, points: [plazaGate(90), [1300, 1640], [1290, 1780], [1290, 1960], [1300, 2100], [1300, 2330]] },
  // 들판 길 (집들 앞)
  { kind: "dirt", width: 46, points: [[300, 2330], [420, 2365], [520, 2340], [660, 2372], [810, 2338], [960, 2372], [1110, 2340], [1300, 2330], [1500, 2348], [1700, 2378], [1900, 2338], [2030, 2368], [2120, 2330], [2260, 2300], [2380, 2330]] },
  // 상점 길: 광장 → 상점 → 둔덕 계단 → 5번 집
  { kind: "stone", width: 50, points: [plazaGate(20), [1600, 1410], [1740, 1420], [1900, 1450], [2060, 1600], [2215, 1610]] },
  { kind: "dirt", width: 42, points: [[2215, 1610], [2225, 1450], [2290, 1436]] },
  // 둔덕 아래에서 10번 집 → 동남쪽 계단 → 들판
  { kind: "dirt", width: 42, points: [[2060, 1600], [2110, 1720], [2130, 1866], [2330, 1866]] },
  { kind: "dirt", width: 42, points: [[2130, 1866], [2180, 1990], [2150, 2120], [2120, 2230], [2120, 2330]] },
  // 옷가게 길: 광장 → 옷가게 → 동쪽 계단 → 언덕 길
  { kind: "stone", width: 50, points: [plazaGate(-20), [1650, 1185], [1890, 1160], [2000, 1120]] },
  { kind: "dirt", width: 42, points: [[2000, 1120], [2120, 1020], [2140, 900], [2085, 800], [2110, 700], [2150, 620], [2100, 560]] },
];

/**
 * 길을 부드럽게 굽힌 점들 (Catmull-Rom, 마디 사이에 점을 더한다). 원래 마디는 그대로 지나서 갈림길 좌표가 바뀌지 않는다.
 * 바닥 그림·사람(NPC) 길 그래프가 같이 쓴다
 */
export function smoothPath(points: readonly (readonly [number, number])[], step = 40): [number, number][] {
  const out: [number, number][] = [];
  const P = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    const n = Math.max(1, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    out.push([p1[0], p1[1]]);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([Math.round(f(p0[0], p1[0], p2[0], p3[0])), Math.round(f(p0[1], p1[1], p2[1], p3[1]))]);
    }
  }
  const last = points[points.length - 1];
  out.push([last[0], last[1]]);
  return out;
}

/** 길가 가로등 (아랫변 가운데). 광장 네 귀퉁이 + 길가 */
export const LAMPS = [
  // 돌광장(한 단 높은 돌 단) 위 네 귀퉁이
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => ({ x: CENTER.x + dx * 172, y: CENTER.y + (dy < 0 ? -128 : 150) })),
  { x: 1070, y: 830 },
  { x: 1230, y: 640 },
  { x: 860, y: 1230 },
  { x: 1580, y: 1480 },
  { x: 1375, y: 1700 },
  { x: 1375, y: 2050 },
  { x: 960, y: 2428 },
  { x: 1690, y: 2432 },
  { x: 2000, y: 1500 },
  { x: 1960, y: 1210 },
  { x: 700, y: 560 },
  { x: 1800, y: 610 },
];

/**
 * 광장 꾸미기 자리 (사용자 요청 2026-10-09). 광장 꾸미기는 쉬는 중이라(2026-10-11, TOWN-16) 그리지 않지만
 * town_decorations.slot 번호가 가리키는 자리라 남겨 둔다 (lib/house.ts decorationSlots)
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

/** i번 집 자리 (아랫변 가운데) */
export function houseSlot(i: number): { x: number; y: number } {
  return HOUSE_LOTS[i];
}

/** i번 자리의 집 (0 = 내 집, 1~10 = 그 자리를 고른(또는 받은) 이웃). 없으면 null = 빈 집터 */
export function houseAt(data: TownData, i: number): TownHouse | null {
  return i === 0 ? data.myHouse : (data.neighbors.find((h) => h.lot === i) ?? null);
}

export type TownSpot = { key: string; label: string; emoji: string; x: number; y: number; href: string | null; empty?: boolean };

/** 텔레포트할 수 있는 곳. 좌표는 캐릭터가 설 자리(문 앞) */
export function townSpots(data: TownData): { places: TownSpot[]; houses: TownSpot[] } {
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
    const label = i === 0 && !data.host ? (h ? "내 집" : "내 집 자리") : h ? `${h.nickname}의 집` : `빈 집터 ${i}`;
    houses.push({ key: `house:${i}`, label, emoji: h ? "🏠" : "🪧", x: p.x, y: p.y + 46, href: h ? `/@${h.slug}` : null, empty: !h });
  }
  return { places, houses };
}
