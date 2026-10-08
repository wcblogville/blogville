import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { animalCares, animalSpecies, userAnimals } from "@/db/schema";
import { type CareAction, levelEggLevels, MAX_ACTIVE_ANIMALS, POST_GROWTH } from "@/lib/farm";
import { todayKST } from "@/lib/game";
import { addLedgerEntry, type Tx } from "@/server/points";

export type FarmAnimal = {
  id: number;
  status: "egg" | "growing" | "grown";
  growth: number;
  name: string | null;
  assetKey: string | null;
  growExp: number | null;
  rewardExp: number | null;
  rewardCoins: number | null;
  grownAt: Date | null;
  caredToday: CareAction[];
};

/** 농장 화면에 필요한 것: 키우는 알·동물, 다 키운 동물, 받을 수 있는 무료 알 */
export async function getFarm(userId: string, level: number) {
  const rows = await db
    .select({
      id: userAnimals.id,
      status: userAnimals.status,
      growth: userAnimals.growth,
      source: userAnimals.source,
      sourceLevel: userAnimals.sourceLevel,
      grownAt: userAnimals.grownAt,
      name: animalSpecies.name,
      assetKey: animalSpecies.assetKey,
      growExp: animalSpecies.growExp,
      rewardExp: animalSpecies.rewardExp,
      rewardCoins: animalSpecies.rewardCoins,
    })
    .from(userAnimals)
    .leftJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .where(eq(userAnimals.userId, userId))
    .orderBy(asc(userAnimals.id));

  const cares = rows.length
    ? await db
        .select({ animalId: animalCares.animalId, action: animalCares.action })
        .from(animalCares)
        .where(and(inArray(animalCares.animalId, rows.map((r) => r.id)), eq(animalCares.date, todayKST())))
    : [];

  const animals: FarmAnimal[] = rows.map((r) => ({
    ...r,
    caredToday: cares.filter((c) => c.animalId === r.id).map((c) => c.action),
  }));
  const active = animals.filter((a) => a.status !== "grown");
  const grown = animals.filter((a) => a.status === "grown").sort((a, b) => (b.grownAt?.getTime() ?? 0) - (a.grownAt?.getTime() ?? 0));

  const hasStarter = rows.some((r) => r.source === "starter");
  const claimedLevels = new Set(rows.filter((r) => r.source === "level").map((r) => r.sourceLevel));
  const freeEggs = [
    ...(hasStarter ? [] : [{ kind: "starter" as const, label: "농장 첫 알" }]),
    ...levelEggLevels(level)
      .filter((l) => !claimedLevels.has(l))
      .map((l) => ({ kind: "level" as const, level: l, label: `레벨 ${l} 보상 알` })),
  ];

  return { active, grown, freeEggs, slotsLeft: MAX_ACTIVE_ANIMALS - active.length };
}

/** 키우는 중인 알·동물 수 (다 키운 동물은 빼고) */
export async function countActive(tx: Tx, userId: string) {
  const [{ n }] = await tx
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(userAnimals)
    .where(and(eq(userAnimals.userId, userId), inArray(userAnimals.status, ["egg", "growing"])));
  return n;
}

export type GrownAnimal = { id: number; name: string; rewardExp: number; rewardCoins: number };

/**
 * 동물에게 성장치를 더하고, 다 자라면 보상을 준다. lockUser를 건 트랜잭션 안에서 호출한다.
 * animalIds가 없으면 그 회원이 키우는 모든 동물 (글쓰기 보상)
 */
export async function addGrowth(tx: Tx, userId: string, amount: number, animalIds?: number[]): Promise<GrownAnimal[]> {
  const where = and(
    eq(userAnimals.userId, userId),
    eq(userAnimals.status, "growing"),
    animalIds ? inArray(userAnimals.id, animalIds) : undefined,
  );
  const updated = await tx
    .update(userAnimals)
    .set({ growth: sql`${userAnimals.growth} + ${amount}` })
    .where(where)
    .returning({ id: userAnimals.id, growth: userAnimals.growth, speciesId: userAnimals.speciesId });
  if (!updated.length) return [];

  const species = await tx
    .select()
    .from(animalSpecies)
    .where(inArray(animalSpecies.id, updated.map((u) => u.speciesId!)));
  const grown: GrownAnimal[] = [];
  for (const u of updated) {
    const sp = species.find((s) => s.id === u.speciesId)!;
    if (u.growth < sp.growExp) continue;
    await tx
      .update(userAnimals)
      .set({ status: "grown", growth: sp.growExp, grownAt: new Date() })
      .where(eq(userAnimals.id, u.id));
    // 다 키운 보상은 종류마다 달라서 REWARD_RULES가 아니라 종류 표의 숫자로 기록한다
    if (sp.rewardExp || sp.rewardCoins) {
      // 경험치가 생기므로 레벨업 알림도 함께 남기는 addLedgerEntry로 (GAME-06 / FR-037)
      await addLedgerEntry(tx, { userId, reason: "farm_grown", expDelta: sp.rewardExp, coinDelta: sp.rewardCoins, refId: u.id });
    }
    grown.push({ id: u.id, name: sp.name, rewardExp: sp.rewardExp, rewardCoins: sp.rewardCoins });
  }
  return grown;
}

/** 공개 글로 보상을 받으면 키우는 동물이 모두 자란다 (회의 결정: 글 1개당 동물마다 10) */
export function growForPost(tx: Tx, userId: string) {
  return addGrowth(tx, userId, POST_GROWTH);
}
