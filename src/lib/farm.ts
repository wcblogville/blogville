// 동물 농장 규칙 (TOWN-09). DB를 쓰지 않는 순수 계산만 둔다
// 종류별 숫자(성장치, 보상)는 animal_species 테이블에 있다 (scripts/seed.ts)

/** 한 번에 키울 수 있는 알·동물 수 (다 키운 동물은 세지 않는다) */
export const MAX_ACTIVE_ANIMALS = 5;
/** 레벨 보상 알: 이 레벨마다 하나 */
export const EGG_LEVEL_EVERY = 5;
/** 상점(농장)에서 알 하나 값 */
export const EGG_PRICE = 100;
/** 공개 글로 보상을 받으면 키우는 동물마다 오르는 성장치 */
export const POST_GROWTH = 10;

export type CareAction = "feed" | "water" | "pet";
export const CARE_ACTIONS: { action: CareAction; label: string; emoji: string; growth: number }[] = [
  { action: "feed", label: "밥 주기", emoji: "🥕", growth: 10 },
  { action: "water", label: "물 주기", emoji: "💧", growth: 10 },
  { action: "pet", label: "쓰다듬기", emoji: "🤲", growth: 5 },
];

export type AnimalStage = "baby" | "teen" | "adult";
export const STAGE_LABEL: Record<AnimalStage, string> = { baby: "아기", teen: "청소년", adult: "어른" };

/** 성장치로 단계 계산: 1/3 미만 아기, 다 자라기 전까지 청소년, 다 자라면 어른 */
export function animalStage(growth: number, growExp: number): AnimalStage {
  if (growth >= growExp) return "adult";
  return growth * 3 < growExp ? "baby" : "teen";
}

/** 지금 레벨까지 받을 수 있는 레벨 보상 알의 레벨 목록 (5, 10, 15, ...) */
export function levelEggLevels(level: number): number[] {
  const list: number[] = [];
  for (let l = EGG_LEVEL_EVERY; l <= level; l += EGG_LEVEL_EVERY) list.push(l);
  return list;
}

/** 비중(weight)에 따라 하나 고르기. r은 0 이상 1 미만 */
export function pickWeighted<T extends { hatchWeight: number }>(list: T[], r: number): T {
  const total = list.reduce((sum, x) => sum + x.hatchWeight, 0);
  let point = r * total;
  for (const x of list) {
    point -= x.hatchWeight;
    if (point < 0) return x;
  }
  return list[list.length - 1];
}

/** 이름 뒤에 주격 조사 (토끼가, 송아지가, 병아리가 / 곰이) */
export function subject(name: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return `${name}${hasFinal ? "이" : "가"}`;
}
