// 집 안(블로그의 "우리 집" 구역) 규칙. DB를 쓰지 않는 순수 계산만 둔다 (화면과 서버 어디서나 import 가능)
import { HOUSE_STAGES, houseStage, type HouseStage } from "@/lib/art/town";

/** 집 단계별 가구 칸 수 (마을 개편 2차): 1단계 4칸, 2단계 6칸, 3단계 8칸 */
export const FURNITURE_SLOTS: Record<HouseStage, number> = { 1: 4, 2: 6, 3: 8 };
/** DB가 허용하는 가장 큰 칸 번호 + 1 (house_furniture_slot_check) */
export const MAX_FURNITURE_SLOTS = 8;

/** 다음 단계가 되는 레벨 (마지막 단계면 null) */
const NEXT_STAGE_LEVEL: Record<HouseStage, number | null> = { 1: 10, 2: 30, 3: null };

export function houseInfo(level: number) {
  const stage = houseStage(level);
  return { stage, name: HOUSE_STAGES[stage].name, slots: FURNITURE_SLOTS[stage], nextLevel: NEXT_STAGE_LEVEL[stage] };
}
