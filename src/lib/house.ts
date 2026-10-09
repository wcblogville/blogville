// 집 규칙 (블로그의 "우리 집" 구역과 광장의 집). DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)
import { HOUSE_STAGE_LEVELS, HOUSE_STAGES, houseStage, MAX_HOUSE_STAGE, type HouseStage } from "@/lib/art/town";
import { isRoofColor, ROOF_COLORS, type RoofColor } from "@/lib/blog";

/** DB가 허용하는 가장 큰 칸 번호 + 1 (house_furniture_slot_check) */
export const MAX_FURNITURE_SLOTS = 8;

/** 집 단계별 가구 칸 수: 1단계 4칸, 2단계 6칸, 3단계부터 8칸 */
export function furnitureSlots(stage: HouseStage): number {
  return Math.min(MAX_FURNITURE_SLOTS, 2 + 2 * stage);
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
