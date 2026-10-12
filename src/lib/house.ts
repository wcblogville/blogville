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

/** 놓인 가구 하나: 바닥 칸(x = 오른쪽 벽을 따라, y = 왼쪽 벽을 따라, 0,0 = 뒤 모서리)과 좌우 뒤집기 */
export type FurnitureSpot = { itemId: number; x: number; y: number; flip: boolean };

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

/**
 * 가구 배치 검사 (화면·서버 공용, 순수 함수). 통과하면 null, 아니면 보여 줄 문구.
 * 순서: 개수(집 단계의 칸 수) → 같은 가구 두 번 → 방 밖 → 같은 칸에 두 개
 */
export function checkLayout(spots: readonly FurnitureSpot[], { grid, limit }: { grid: number; limit: number }): string | null {
  if (spots.length > limit) return `지금 집에는 가구를 ${limit}개까지 놓을 수 있어요.`;
  const items = new Set<number>();
  const tiles = new Set<string>();
  for (const s of spots) {
    if (items.has(s.itemId)) return "같은 가구는 한 번만 놓을 수 있어요.";
    items.add(s.itemId);
    if (![s.x, s.y].every((v) => Number.isInteger(v) && v >= 0 && v < grid)) return "방 밖에는 놓을 수 없어요.";
    const key = `${s.x},${s.y}`;
    if (tiles.has(key)) return "한 칸에는 가구 하나만 놓을 수 있어요.";
    tiles.add(key);
  }
  return null;
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
