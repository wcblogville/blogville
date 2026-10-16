import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { animalSpecies, userAnimals } from "@/db/schema";
import { DEX_SLOTS, DEX_TOTAL, dexProgress, DRAGON_CODE } from "@/lib/dex";
import { ANIMAL_SEXES, type HatchRarity } from "@/lib/farm";
import type { Tx } from "@/server/points";

/** 회원이 연 도감 칸: 깨어난(키우는 중·다 자란) 동물의 종류, 다 자란 동물의 특별 진화. 동물은 지우지 않으므로 기록이 곧 도감이다 */
async function unlocked(q: Tx | typeof db, userId: string) {
  const [species, variants] = await Promise.all([
    q
      .selectDistinct({ code: animalSpecies.code })
      .from(userAnimals)
      .innerJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
      .where(and(eq(userAnimals.userId, userId), ne(userAnimals.status, "egg"))),
    q
      .selectDistinct({ key: userAnimals.variant })
      .from(userAnimals)
      .where(and(eq(userAnimals.userId, userId), isNotNull(userAnimals.variant))),
  ]);
  return { species: new Set(species.map((r) => r.code)), variants: new Set(variants.map((r) => r.key!)) };
}

export type DexEntry =
  | { kind: "species"; key: string; rarity: HatchRarity; unlocked: boolean; name: string; assetKey: string }
  | { kind: "variant"; key: string; unlocked: boolean; name: string; assetKey: string; speciesName: string };

/** 도감 (블로그 우리 집 [도감] 창): 모든 칸과 열렸는지, 보상 용을 받았는지 */
export async function getDex(userId: string) {
  const [open, species] = await Promise.all([
    unlocked(db, userId),
    db.select({ code: animalSpecies.code, name: animalSpecies.name, assetKey: animalSpecies.assetKey }).from(animalSpecies),
  ]);
  const byCode = new Map(species.map((s) => [s.code, s]));
  const entries: DexEntry[] = DEX_SLOTS.flatMap((slot): DexEntry[] => {
    if (slot.kind === "species") {
      const sp = byCode.get(slot.key);
      return sp ? [{ kind: "species", key: slot.key, rarity: slot.rarity, unlocked: open.species.has(slot.key), name: sp.name, assetKey: sp.assetKey }] : [];
    }
    const sp = byCode.get(slot.species);
    return sp ? [{ kind: "variant", key: slot.key, unlocked: open.variants.has(slot.key), name: slot.name, assetKey: sp.assetKey, speciesName: sp.name }] : [];
  });
  const dragon = byCode.get(DRAGON_CODE) ?? null;
  return {
    entries,
    count: entries.filter((e) => e.unlocked).length,
    total: DEX_TOTAL,
    reward: dragon && { name: dragon.name, assetKey: dragon.assetKey, received: open.species.has(DRAGON_CODE) },
  };
}

export type Dex = Awaited<ReturnType<typeof getDex>>;

/**
 * 도감을 다 채웠으면 용을 준다 (한 번만, 다 자란 모습으로). lockUser를 건 트랜잭션 안에서 부른다
 * (동물이 다 자란 직후, src/server/farm.ts addGrowth). 받았으면 용 이름, 아니면 null
 */
export async function grantDexReward(tx: Tx, userId: string): Promise<string | null> {
  const open = await unlocked(tx, userId);
  if (open.species.has(DRAGON_CODE) || dexProgress(open.species, open.variants) < DEX_TOTAL) return null;
  const [dragon] = await tx.select().from(animalSpecies).where(eq(animalSpecies.code, DRAGON_CODE));
  if (!dragon) return null;
  const now = new Date();
  await tx.insert(userAnimals).values({
    userId,
    speciesId: dragon.id,
    status: "grown",
    growth: dragon.growExp,
    source: "reward",
    sex: ANIMAL_SEXES[randomInt(ANIMAL_SEXES.length)],
    hatchedAt: now,
    grownAt: now,
  });
  return dragon.name;
}
