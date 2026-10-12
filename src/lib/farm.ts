// 동물 농장 규칙 (TOWN-09). DB를 쓰지 않는 순수 계산만 둔다
// 종류별 숫자(성장치, 보상)는 animal_species 테이블에 있다 (scripts/seed.ts)
import type { IconName } from "./art/icons";


/** 한 번에 키울 수 있는 알·동물 수 (다 키운 동물은 세지 않는다) */
export const MAX_ACTIVE_ANIMALS = 5;
/** 레벨 보상 알: 이 레벨마다 하나 */
export const EGG_LEVEL_EVERY = 5;
/** 상점(농장)에서 알 하나 값 */
export const EGG_PRICE = 100;
/** 공개 글로 보상을 받으면 키우는 동물마다 오르는 성장치 */
export const POST_GROWTH = 10;

export type CareAction = "feed" | "water" | "pet";
export const CARE_ACTIONS: { action: CareAction; label: string; icon: IconName; growth: number }[] = [
  { action: "feed", label: "밥 주기", icon: "carrot", growth: 10 },
  { action: "water", label: "물 주기", icon: "drop", growth: 10 },
  { action: "pet", label: "쓰다듬기", icon: "hand", growth: 5 },
];

export type AnimalStage = "baby" | "teen" | "adult";
export const STAGE_LABEL: Record<AnimalStage, string> = { baby: "아기", teen: "청소년", adult: "어른" };

/**
 * 다 키운 동물의 크기 (사용자 요청 2026-10-12 "햄스터는 완전 작게 데리고 다니고 싶을 수 있잖아").
 * 주인이 농장에서 마음대로 바꾼다 (무료). DB user_animals.display_size (CHECK가 이 목록과 같다).
 * 늘이거나 줄이지 않고 몸 반지름을 바꿔 다시 그려서 도트가 흐려지지 않는다 (animals.ts animalRadius)
 */
export const ANIMAL_DISPLAY_SIZES = ["tiny", "small", "normal", "large"] as const;
export type AnimalDisplaySize = (typeof ANIMAL_DISPLAY_SIZES)[number];
export const DISPLAY_SIZE_LABEL: Record<AnimalDisplaySize, string> = { tiny: "아주 작게", small: "작게", normal: "보통", large: "크게" };
export function isDisplaySize(v: unknown): v is AnimalDisplaySize {
  return typeof v === "string" && (ANIMAL_DISPLAY_SIZES as readonly string[]).includes(v);
}

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

// ===== 알 확률·암수·특별 진화 (사용자 요청 2026-10-12 "노말한 동물들이랑 희귀한 애들이랑 확률 다르게", "암/수 별로 성장했을 때 모습",
// "낮은 확률로 망아지가 유니콘이나 페가수스 … 진화") =====
// 숫자는 모두 여기 한 곳에서 정한다. 농장 ⓘ 안내 창도 이 표를 그대로 보여 준다. 실제 뽑기는 서버가 node:crypto로 한다

/**
 * 알에서 나오는 등급 (2026-10-12 "희귀 매우 희귀 이런식으로", 야생 동물 열 종류를 더하며 네 등급으로 다시 짰다).
 * 보통(농장 동물) 50% · 희귀(집·숲 동물) 30% · 매우 희귀(큰 숲 동물) 15% · 전설(맹수의 왕들) 5%.
 * 키(common·rare·epic)는 예전 그대로 두고 이름만 바꿨다 (예전 "일반"·"아주 희귀")
 */
export type HatchRarity = "common" | "rare" | "epic" | "legend";
export const RARITY_LABEL: Record<HatchRarity, string> = { common: "보통", rare: "희귀", epic: "매우 희귀", legend: "전설" };
/** 등급 도트 아이콘 (src/lib/art/icons.ts, 그림 글자 대신: 2026-10-12 도트 아이콘) */
export const RARITY_ICON: Record<HatchRarity, IconName> = { common: "egg", rare: "star", epic: "sparkle", legend: "crown" };
/** 등급마다 알에서 나올 확률 (%), 모두 더하면 100. 같은 등급 안의 동물들은 똑같이 나눈다 */
export const RARITY_ODDS: Record<HatchRarity, number> = { common: 50, rare: 30, epic: 15, legend: 5 };
/** 동물 종류(animal_species.code)마다 등급. 알에서는 열아홉 종류가 모두 나온다 (분양은 값을 내고 바로 고른다) */
export const HATCH_RARITY: Record<string, HatchRarity> = {
  // 보통 50% (다섯 종류, 하나에 10%): 농장에서 흔한 동물
  chick: "common",
  bunny: "common",
  hamster: "common",
  piglet: "common",
  lamb: "common",
  // 희귀 30% (여섯 종류, 하나에 5%): 집에서 키우는 동물과 순한 숲 동물
  kitten: "rare",
  puppy: "rare",
  calf: "rare",
  turtle: "rare",
  fox: "rare",
  deer: "rare",
  // 매우 희귀 15% (네 종류, 하나에 3.75%): 크고 빠른 동물
  pony: "epic",
  bear: "epic",
  wolf: "epic",
  cheetah: "epic",
  // 전설 5% (네 종류, 하나에 1.25%): 맹수의 왕들
  tiger: "legend",
  lion: "legend",
  leopard: "legend",
  eagle: "legend",
};
export const RARITY_ORDER: HatchRarity[] = ["common", "rare", "epic", "legend"];
/** 알 확률 비중의 합 (만분율: 1 = 0.01%) */
export const HATCH_WEIGHT_TOTAL = 10_000;

/** 이 종류가 알에서 나올 확률 (%) */
export function hatchPercent(code: string): number {
  const tier = HATCH_RARITY[code];
  if (!tier) return 0;
  const same = Object.values(HATCH_RARITY).filter((t) => t === tier).length;
  return RARITY_ODDS[tier] / same;
}
/** DB animal_species.hatch_weight에 넣는 비중 (만분율, scripts/seed.ts가 쓴다). 모두 더하면 HATCH_WEIGHT_TOTAL */
export function hatchWeightOf(code: string): number {
  return Math.round(hatchPercent(code) * (HATCH_WEIGHT_TOTAL / 100));
}

/** 암수 (부화·분양할 때 반반으로 정한다, DB user_animals.sex) */
export const ANIMAL_SEXES = ["female", "male"] as const;
export type AnimalSex = (typeof ANIMAL_SEXES)[number];
export const SEX_LABEL: Record<AnimalSex, string> = { female: "암컷", male: "수컷" };
export const SEX_MARK: Record<AnimalSex, string> = { female: "♀", male: "♂" };
export function isSex(v: unknown): v is AnimalSex {
  return typeof v === "string" && (ANIMAL_SEXES as readonly string[]).includes(v);
}
/** 암수마다 어른 모습이 어떻게 다른지 (ⓘ 안내 창) */
export const SEX_LOOKS: Record<string, { female: string; male: string }> = {
  chick: { female: "작은 볏의 암탉", male: "큰 볏·긴 꽁지깃의 수탉" },
  bunny: { female: "긴 속눈썹", male: "볼이 통통한 수토끼" },
  hamster: { female: "긴 속눈썹", male: "볼주머니가 더 빵빵" },
  piglet: { female: "긴 속눈썹", male: "작은 엄니와 등 갈기" },
  kitten: { female: "긴 속눈썹", male: "볼살이 통통한 수고양이" },
  puppy: { female: "긴 속눈썹", male: "쫑긋 선 귀" },
  lamb: { female: "뿔 없는 암양", male: "돌돌 말린 뿔의 숫양" },
  calf: { female: "작은 뿔의 암소", male: "큰 뿔과 코뚜레의 황소" },
  pony: { female: "땋은 갈기의 암말", male: "길게 휘날리는 갈기의 수말" },
  bear: { female: "긴 속눈썹", male: "어깨에 불룩한 혹" },
  fox: { female: "긴 속눈썹", male: "더 풍성한 꼬리와 가슴 털" },
  wolf: { female: "긴 속눈썹", male: "목에 풍성한 갈기 털" },
  tiger: { female: "긴 속눈썹", male: "볼 털이 옆으로 뻗은 수호랑이" },
  lion: { female: "갈기 없는 암사자", male: "머리를 감싼 큰 갈기의 수사자" },
  eagle: { female: "긴 속눈썹", male: "뒤통수에 깃 두 가닥" },
  turtle: { female: "긴 속눈썹", male: "길쭉한 꼬리" },
  cheetah: { female: "긴 속눈썹", male: "목덜미 털이 쭈뼛" },
  leopard: { female: "긴 속눈썹", male: "굵은 목과 큰 머리" },
  deer: { female: "뿔 없는 암사슴", male: "가지 친 뿔의 수사슴" },
};

/**
 * 다 키운 동물을 데리고 다닐 모습 (사용자 요청 2026-10-12 "아기 형태로 데리고 다닐 수도 있게").
 * DB user_animals.display_form (CHECK가 이 목록과 같다). 다 자란 동물만 고른다
 */
export const ANIMAL_FORMS = ["adult", "baby"] as const;
export type AnimalForm = (typeof ANIMAL_FORMS)[number];
export const FORM_LABEL: Record<AnimalForm, string> = { adult: "다 자란 모습", baby: "아기 모습" };
export function isAnimalForm(v: unknown): v is AnimalForm {
  return typeof v === "string" && (ANIMAL_FORMS as readonly string[]).includes(v);
}

/**
 * 특별 진화: 다 자라는 순간 낮은 확률로 특별한 모습이 된다 (DB user_animals.variant = key).
 * chance = 그 동물이 다 자랄 때 이 모습이 될 확률 (%). 그림은 src/lib/art/animals.ts ANIMAL_VARIANT_ART
 */
export type SpecialVariant = { key: string; species: string; name: string; chance: number; look: string };
export const SPECIAL_VARIANTS: SpecialVariant[] = [
  { key: "golden_hen", species: "chick", name: "황금 닭", chance: 4, look: "금빛으로 반짝이는 깃털" },
  { key: "dutch_bunny", species: "bunny", name: "얼룩 토끼", chance: 4, look: "앞은 하얗고 눈가·귀·엉덩이는 진회색" },
  { key: "panda_hamster", species: "hamster", name: "판다 햄스터", chance: 4, look: "눈가와 귀가 까만 판다 무늬" },
  { key: "black_pig", species: "piglet", name: "흑돼지", chance: 4, look: "새까만 털과 등 갈기" },
  { key: "galaxy_cat", species: "kitten", name: "은하수 고양이", chance: 4, look: "밤하늘 털에 별이 콕콕" },
  { key: "angel_puppy", species: "puppy", name: "천사 강아지", chance: 4, look: "하얀 날개와 금빛 고리" },
  { key: "rainbow_lamb", species: "lamb", name: "무지개 양", chance: 4, look: "일곱 빛깔 털" },
  { key: "strawberry_calf", species: "calf", name: "딸기우유 송아지", chance: 4, look: "분홍 몸에 딸기 무늬" },
  { key: "unicorn", species: "pony", name: "유니콘", chance: 3, look: "금빛 뿔과 무지개 갈기" },
  { key: "pegasus", species: "pony", name: "페가수스", chance: 3, look: "하늘색 갈기와 커다란 날개" },
  // 야생 동물 (2026-10-12): 한 가지면 4%, 두 가지면 3% + 3% (구미호·불사조는 더 드물게 2%)
  { key: "panda_bear", species: "bear", name: "판다곰", chance: 3, look: "흰 몸에 까만 눈가·귀·다리" },
  { key: "polar_bear", species: "bear", name: "북극곰", chance: 3, look: "새하얀 털" },
  { key: "silver_fox", species: "fox", name: "은여우", chance: 3, look: "은빛이 섞인 까만 털" },
  { key: "nine_tailed", species: "fox", name: "구미호", chance: 2, look: "하얀 털, 여러 갈래 꼬리와 푸른 여우불" },
  { key: "snow_wolf", species: "wolf", name: "설원 늑대", chance: 4, look: "눈처럼 하얀 털과 얼음빛 눈" },
  { key: "white_tiger", species: "tiger", name: "백호", chance: 4, look: "하얀 몸에 짙은 줄무늬, 파란 눈" },
  { key: "white_lion", species: "lion", name: "백사자", chance: 4, look: "크림빛 하얀 몸과 갈기" },
  { key: "golden_eagle", species: "eagle", name: "황금 독수리", chance: 3, look: "금빛으로 반짝이는 깃털" },
  { key: "phoenix", species: "eagle", name: "불사조", chance: 2, look: "불꽃빛 몸과 불꽃 볏·꼬리 깃" },
  { key: "golden_turtle", species: "turtle", name: "황금 거북", chance: 4, look: "금빛으로 반짝이는 등딱지" },
  { key: "king_cheetah", species: "cheetah", name: "킹치타", chance: 4, look: "점이 이어진 굵은 얼룩과 등줄무늬" },
  { key: "black_panther", species: "leopard", name: "흑표범", chance: 3, look: "까만 털에 희미한 꽃무늬" },
  { key: "snow_leopard", species: "leopard", name: "눈표범", chance: 3, look: "하얀 털에 회색 꽃무늬" },
  { key: "silver_deer", species: "deer", name: "은빛 사슴", chance: 3, look: "은빛 털과 수정처럼 빛나는 뿔" },
  { key: "glowing_reindeer", species: "deer", name: "빛나는 순록", chance: 3, look: "크고 넓은 뿔, 하얀 목털, 빨갛게 빛나는 코" },
];
export function variantOf(key: string | null | undefined): SpecialVariant | null {
  return (key && SPECIAL_VARIANTS.find((v) => v.key === key)) || null;
}
/** 이 종류의 특별 진화 목록 */
export function variantsFor(code: string): SpecialVariant[] {
  return SPECIAL_VARIANTS.filter((v) => v.species === code);
}
/** 이 종류가 특별하게 자랄 확률 (%) */
export function specialPercent(code: string): number {
  return variantsFor(code).reduce((sum, v) => sum + v.chance, 0);
}
/** 다 자랄 때 특별 진화 고르기. r은 0 이상 1 미만 (서버는 node:crypto). 보통이면 null */
export function pickSpecial(code: string, r: number): SpecialVariant | null {
  let point = r * 100;
  for (const v of variantsFor(code)) {
    point -= v.chance;
    if (point < 0) return v;
  }
  return null;
}
/** 화면에 보일 이름: 특별 진화면 그 이름 */
export function animalName(name: string, variant?: string | null): string {
  return variantOf(variant)?.name ?? name;
}

/** 이름 뒤에 "(으)로" (유니콘으로, 페가수스로, 황금 닭으로, 얼룩 토끼로) */
export function toward(name: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  const final = code >= 0 && code <= 11171 ? code % 28 : 0;
  return `${name}${final === 0 || final === 8 ? "로" : "으로"}`;
}
