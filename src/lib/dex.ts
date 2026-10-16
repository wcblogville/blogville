// 동물 도감 칸 (2026-10-16 "한 마리도 부화시키기 전에는 모든 동물을(특수진화 포함) 그림자 카드로, 얻으면 열리게, 다 해금하면 용"):
// 알에서 나오는 종류 전부(HATCH_RARITY) + 특별 진화 전부(SPECIAL_VARIANTS). 보상 동물(용)은 칸에 넣지 않는다.
// 종류 칸은 그 동물을 깨우거나 분양받으면, 특별 진화 칸은 그 모습으로 다 키우면 열린다 (src/server/dex.ts)
import { HATCH_RARITY, type HatchRarity, RARITY_ORDER, SPECIAL_VARIANTS } from "@/lib/farm";

/** 도감을 다 채우면 오는 동물 (animal_species.code, reward_only) */
export const DRAGON_CODE = "dragon";

export type DexSlot =
  | { kind: "species"; key: string; rarity: HatchRarity }
  | { kind: "variant"; key: string; species: string; name: string };

/** 도감 칸 순서: 종류는 흔한 등급부터, 특별 진화는 그 뒤에 표 순서대로 */
export const DEX_SLOTS: DexSlot[] = [
  ...RARITY_ORDER.flatMap((rarity) =>
    Object.entries(HATCH_RARITY)
      .filter(([, r]) => r === rarity)
      .map(([key]) => ({ kind: "species" as const, key, rarity })),
  ),
  ...SPECIAL_VARIANTS.map((v) => ({ kind: "variant" as const, key: v.key, species: v.species, name: v.name })),
];

export const DEX_TOTAL = DEX_SLOTS.length;

/** 열린 칸 수 (가진 종류 코드·특별 진화 키로 센다. 칸에 없는 코드는 세지 않는다) */
export function dexProgress(species: Iterable<string>, variants: Iterable<string>): number {
  const sp = new Set(species);
  const va = new Set(variants);
  return DEX_SLOTS.filter((s) => (s.kind === "species" ? sp.has(s.key) : va.has(s.key))).length;
}
