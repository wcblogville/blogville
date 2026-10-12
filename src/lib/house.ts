// 집 규칙 (블로그의 "우리 집" 구역과 광장의 집). DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)
import { HOUSE_STAGE_LEVELS, HOUSE_STAGES, houseStage, MAX_HOUSE_STAGE, type HouseStage } from "@/lib/art/town";
import { isRoofColor, ROOF_COLORS, type RoofColor } from "@/lib/blog";

/** 우리 집에 놓을 수 있는 가구의 가장 많은 개수 (3단계부터) */
export const MAX_FURNITURE_SLOTS = 8;

/** 집 단계별로 놓을 수 있는 가구 수: 1단계 4개, 2단계 6개, 3단계부터 8개 */
export function furnitureSlots(stage: HouseStage): number {
  return Math.min(MAX_FURNITURE_SLOTS, 2 + 2 * stage);
}

/** 광장 꾸미기 자리 (src/components/town/layout.ts DECO_SLOTS, town_decorations_slot_check) */
export const MAX_DECO_SLOTS = 8;

/** 광장 꾸미기 자리 수: 집이 클수록 많다. 가구 칸과 같이 1단계 4자리, 2단계 6자리, 3단계부터 8자리 (사용자 요청 2026-10-09) */
export function decorationSlots(level: number): number {
  return Math.min(MAX_DECO_SLOTS, furnitureSlots(houseStage(level)));
}

/** 이 꾸미기 자리(0부터)가 열리는 레벨 */
export function decoSlotLevel(slot: number): number {
  let stage = 1;
  while (stage < MAX_HOUSE_STAGE && furnitureSlots(stage as HouseStage) <= slot) stage++;
  return stage === 1 ? 1 : (stage - 1) * HOUSE_STAGE_LEVELS;
}

/** 집 단계·이름·가구 칸 수·다음 단계가 되는 레벨 (마지막 단계면 null). 10레벨마다 한 단계 (사용자 결정 2026-10-09) */
export function houseInfo(level: number) {
  const stage = houseStage(level);
  return {
    stage,
    name: HOUSE_STAGES[stage].name,
    slots: furnitureSlots(stage),
    nextLevel: stage < MAX_HOUSE_STAGE ? stage * HOUSE_STAGE_LEVELS : null,
  };
}

export const ROOF_LABELS: Record<RoofColor, string> = {
  red: "빨강",
  orange: "주황",
  yellow: "노랑",
  green: "초록",
  sky: "하늘",
  blue: "파랑",
  purple: "보라",
  brown: "갈색",
  pink: "분홍",
  mint: "민트",
};

/** 같은 수를 넣으면 늘 같은 순서로 나오는 난수 (mulberry32) */
function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 블로그마다 정해진 지붕 색 순서 (블로그 번호로 섞는다). 첫 색이 가입 때 받은 무작위 색이고,
 * 집이 한 단계 클 때마다 다음 색이 하나씩 열린다 (TOWN-07, 사용자 결정 2026-10-09). 순서를 저장하지 않아도 늘 같다
 */
export function roofOrder(blogId: number): RoofColor[] {
  const list = [...ROOF_COLORS];
  const rand = seeded(blogId);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** 지금 고를 수 있는 지붕 색: 집 단계 수만큼 (1단계 1색 … 10단계 10색) */
export function unlockedRoofs(blogId: number, stage: HouseStage): RoofColor[] {
  return roofOrder(blogId).slice(0, stage);
}

/** 지금 지붕 색: 고른 색(blogs.roof_color)이 없으면 처음 받은 무작위 색 */
export function currentRoof(blogId: number, chosen: string | null): RoofColor {
  return isRoofColor(chosen) ? chosen : roofOrder(blogId)[0];
}

// ===== 우리 집 방: 아이소메트릭 바닥 칸과 가구 자유 배치 (사용자 요청 2026-10-12 "가구 배치 내 마음대로", "정육면체 형태로") =====

/** 방 바닥 한 변의 가장 큰 칸 수 (house_furniture_tile_check: 0~9) */
export const MAX_ROOM_GRID = 10;

/** 집 단계별 방 바닥 칸 수 (정사각형 한 변): 1단계 6×6, 2단계 7×7 … 5단계부터 10×10. 집이 크면 방도 넓다 */
export function roomGrid(stage: HouseStage): number {
  return Math.min(MAX_ROOM_GRID, 5 + stage);
}

/** 놓인 가구 하나: 바닥 칸(x = 오른쪽 벽을 따라, y = 왼쪽 벽을 따라, 0,0 = 뒤 모서리)과 좌우 뒤집기. x, y는 가구가 차지하는 칸들의 뒤 모서리 칸 */
export type FurnitureSpot = { itemId: number; x: number; y: number; flip: boolean };

/**
 * 가구가 차지하는 바닥 칸 수 (사용자 요청 2026-10-12 "가구마다 크기 다르게 해줘 침대같은 경우는 사람보다 컸으면").
 * w = x축(오른쪽 벽을 따라) 칸 수, d = y축(왼쪽 벽을 따라) 칸 수. 여기에 없는 가구는 1×1.
 * 아이소메트릭 방에서 좌우 뒤집기는 x축과 y축을 맞바꾼 것과 같아서, 뒤집으면 w와 d가 바뀐다 (footprintOf).
 * 화면(편집 미리보기·길 찾기)과 서버(checkLayout) 모두 이 표 하나를 쓴다. 그림 크기는 src/lib/art/room-furniture.ts가 이 표에 맞춰 그린다
 */
export const FURNITURE_FOOTPRINT: Readonly<Record<string, { w: number; d: number }>> = {
  // 침대는 누운 사람보다 길고 넓다 (3 × 2칸)
  "furniture.bed": { w: 3, d: 2 },
  "furniture.canopy": { w: 3, d: 2 },
  // 러그는 넓고 납작하다 (그 위를 걸을 수 있다, WALKABLE_FURNITURE)
  "furniture.rug": { w: 2, d: 2 },
  // 긴 가구 (2 × 1칸)
  "furniture.table": { w: 2, d: 1 },
  "furniture.desk": { w: 2, d: 1 },
  "furniture.computer": { w: 2, d: 1 },
  "furniture.sofa": { w: 2, d: 1 },
  "furniture.piano": { w: 2, d: 1 },
  "furniture.fireplace": { w: 2, d: 1 },
  "furniture.aquarium": { w: 2, d: 1 },
  "furniture.cupboard": { w: 2, d: 1 },
};

/** 밟고 지나갈 수 있는 가구 (캐릭터 길 찾기에서 막지 않는다. 배치에서는 다른 가구와 겹칠 수 없다) */
export const WALKABLE_FURNITURE: ReadonlySet<string> = new Set(["furniture.rug"]);

/** 가구가 차지하는 칸 수 (뒤집으면 w·d가 바뀐다) */
export function footprintOf(assetKey: string | undefined, flip = false): { w: number; d: number } {
  const f = (assetKey && FURNITURE_FOOTPRINT[assetKey]) || { w: 1, d: 1 };
  return flip ? { w: f.d, d: f.w } : { w: f.w, d: f.d };
}

/** 가구가 차지하는 칸들 ("x,y") */
export function footprintTiles(assetKey: string | undefined, s: { x: number; y: number; flip: boolean }): string[] {
  const { w, d } = footprintOf(assetKey, s.flip);
  const out: string[] = [];
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.push(`${s.x + i},${s.y + j}`);
  return out;
}

/** 가구가 방 안에 다 들어가는지 */
export function fitsRoom(assetKey: string | undefined, s: { x: number; y: number; flip: boolean }, grid: number): boolean {
  const { w, d } = footprintOf(assetKey, s.flip);
  return Number.isInteger(s.x) && Number.isInteger(s.y) && s.x >= 0 && s.y >= 0 && s.x + w <= grid && s.y + d <= grid;
}

/**
 * 옛 칸 번호(0~7) → 바닥 칸. 마이그레이션 0035와 가입(기본 가구 2개)이 같은 자리를 쓴다.
 * 모두 가장 작은 방(6×6) 안이고 겹치지 않는다. 0 화분은 뒤 모서리 옆, 1 의자는 오른쪽 벽 앞
 */
export const DEFAULT_TILES: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 0],
  [0, 3],
  [4, 0],
  [2, 2],
  [3, 4],
  [5, 2],
  [1, 5],
];

/** 가구 id → asset_key (모르는 가구는 1×1로 본다) */
export type KeyOf = (itemId: number) => string | undefined;

/**
 * 가구 배치 검사 (화면·서버 공용, 순수 함수). 통과하면 null, 아니면 보여 줄 문구.
 * 순서: 개수(집 단계의 칸 수) → 같은 가구 두 번 → 방 밖(가구가 차지하는 칸이 하나라도 밖) → 다른 가구와 겹침(차지하는 칸끼리)
 */
export function checkLayout(spots: readonly FurnitureSpot[], { grid, limit, keyOf = () => undefined }: { grid: number; limit: number; keyOf?: KeyOf }): string | null {
  if (spots.length > limit) return `지금 집에는 가구를 ${limit}개까지 놓을 수 있어요.`;
  const items = new Set<number>();
  const tiles = new Set<string>();
  for (const s of spots) {
    if (items.has(s.itemId)) return "같은 가구는 한 번만 놓을 수 있어요.";
    items.add(s.itemId);
    const key = keyOf(s.itemId);
    if (!fitsRoom(key, s, grid)) return "방 밖에는 놓을 수 없어요.";
    for (const t of footprintTiles(key, s)) {
      if (tiles.has(t)) return "가구끼리 겹쳐 놓을 수 없어요.";
      tiles.add(t);
    }
  }
  return null;
}

/** 빈 자리 하나 찾기: 뒤 모서리에서 가까운 칸부터, 그대로 → 뒤집어서. 없으면 null */
export function findFreeSpot(
  assetKey: string | undefined,
  taken: ReadonlySet<string>,
  grid: number,
  prefer: { x: number; y: number; flip: boolean } | null = null,
): { x: number; y: number; flip: boolean } | null {
  const fits = (s: { x: number; y: number; flip: boolean }) => fitsRoom(assetKey, s, grid) && footprintTiles(assetKey, s).every((t) => !taken.has(t));
  if (prefer) {
    if (fits(prefer)) return prefer;
    if (fits({ ...prefer, flip: !prefer.flip })) return { ...prefer, flip: !prefer.flip };
  }
  const flips = prefer ? [prefer.flip, !prefer.flip] : [false, true];
  for (let sum = 0; sum < grid * 2 - 1; sum++) {
    for (let x = 0; x <= sum; x++) {
      for (const flip of flips) {
        const s = { x, y: sum - x, flip };
        if (s.x < grid && s.y < grid && fits(s)) return s;
      }
    }
  }
  return null;
}

/**
 * 저장된 배치를 지금 규칙에 맞게 고쳐 읽기 (화면에서 읽을 때마다, 순수 함수 · DB는 바꾸지 않는다).
 * 2026-10-12 가구 크기가 생기면서 예전에 1칸씩 놓았던 배치가 겹치거나 방 밖으로 나갈 수 있다.
 * 앞에서부터(뒤 → 앞 칸 순) 그대로 들어가면 두고, 안 되면 같은 자리에서 뒤집어 보고, 그래도 안 되면 뒤 모서리에서 가까운 빈 자리로 옮긴다.
 * 방에 자리가 없으면 그 가구는 보여 주지 않는다. 주인이 [가구 놓기]에서 저장하면 고친 배치가 DB에 남는다.
 * moved = 옮기거나 뒤집거나 뺀 가구 수
 */
export function repairLayout<T extends FurnitureSpot & { assetKey: string }>(spots: readonly T[], grid: number): { spots: T[]; moved: number } {
  const taken = new Set<string>();
  const out: T[] = [];
  let moved = 0;
  for (const s of spots) {
    const at = findFreeSpot(s.assetKey, taken, grid, { x: s.x, y: s.y, flip: s.flip });
    if (!at) {
      moved++;
      continue;
    }
    if (at.x !== s.x || at.y !== s.y || at.flip !== s.flip) moved++;
    for (const t of footprintTiles(s.assetKey, at)) taken.add(t);
    out.push({ ...s, ...at });
  }
  return { spots: out, moved };
}

/** 서버로 온 배치 값 읽기 (모양만 확인. 규칙은 checkLayout). 모양이 틀리면 null */
export function parseLayout(input: unknown): FurnitureSpot[] | null {
  if (!Array.isArray(input) || input.length > 64) return null;
  const out: FurnitureSpot[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return null;
    const { itemId, x, y, flip } = raw as Record<string, unknown>;
    if (![itemId, x, y].every((v) => typeof v === "number" && Number.isInteger(v))) return null;
    if ((itemId as number) <= 0 || (itemId as number) > 2_147_483_647) return null;
    out.push({ itemId: itemId as number, x: x as number, y: y as number, flip: flip === true });
  }
  return out;
}
