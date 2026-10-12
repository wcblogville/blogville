import "server-only";
import { randomInt } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { animalCares, animalSkins, animalSpecies, userAnimalSkins, userAnimals } from "@/db/schema";
import {
  ANIMAL_SEXES,
  type AnimalDisplaySize,
  type AnimalForm,
  type AnimalSex,
  type CareAction,
  levelEggLevels,
  MAX_ACTIVE_ANIMALS,
  pickSpecial,
  POST_GROWTH,
} from "@/lib/farm";
import { todayKST } from "@/lib/game";
import { addLedgerEntry, type Tx } from "@/server/points";

export type FarmAnimal = {
  id: number;
  status: "egg" | "growing" | "grown";
  growth: number;
  speciesId: number | null;
  /** 입힌 스킨 (animal_skins.id·asset_key, 없으면 기본 색) */
  skinId: number | null;
  skinKey: string | null;
  /** 다 키운 동물 크기 (주인이 고른다, 2026-10-12) */
  displaySize: AnimalDisplaySize;
  /** 암수 (알이면 null), 특별 진화 키 (보통이면 null), 데리고 다닐 모습 (2026-10-12) */
  sex: AnimalSex | null;
  variant: string | null;
  displayForm: AnimalForm;
  /** 종류 코드 (animal_species.code, 알이면 null) */
  code: string | null;
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
      speciesId: userAnimals.speciesId,
      skinId: userAnimals.skinId,
      skinKey: animalSkins.assetKey,
      displaySize: sql<AnimalDisplaySize>`${userAnimals.displaySize}`,
      sex: sql<AnimalSex | null>`${userAnimals.sex}`,
      variant: userAnimals.variant,
      displayForm: sql<AnimalForm>`${userAnimals.displayForm}`,
      code: animalSpecies.code,
      name: animalSpecies.name,
      assetKey: animalSpecies.assetKey,
      growExp: animalSpecies.growExp,
      rewardExp: animalSpecies.rewardExp,
      rewardCoins: animalSpecies.rewardCoins,
    })
    .from(userAnimals)
    .leftJoin(animalSpecies, eq(animalSpecies.id, userAnimals.speciesId))
    .leftJoin(animalSkins, eq(animalSkins.id, userAnimals.skinId))
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

  const [adoptable, skins, hatchOdds] = await Promise.all([listAdoptable(), listSkins(userId), listHatchOdds()]);
  return { active, grown, freeEggs, slotsLeft: MAX_ACTIVE_ANIMALS - active.length, adoptable, skins, hatchOdds };
}

export type HatchOdds = { code: string; name: string; assetKey: string; hatchWeight: number };

/** 알에서 나오는 종류와 비중 (부화와 같은 표를 ⓘ 안내 창에 보여 준다. 비중 합으로 나누면 확률) */
export async function listHatchOdds(): Promise<HatchOdds[]> {
  return db
    .select({ code: animalSpecies.code, name: animalSpecies.name, assetKey: animalSpecies.assetKey, hatchWeight: animalSpecies.hatchWeight })
    .from(animalSpecies)
    .orderBy(sql`${animalSpecies.hatchWeight} DESC`, asc(animalSpecies.id));
}

/** 부화·분양할 때 암수 (반반, node:crypto) */
export function randomSex(): AnimalSex {
  return ANIMAL_SEXES[randomInt(ANIMAL_SEXES.length)];
}

export type AdoptableSpecies = { id: number; code: string; name: string; assetKey: string; price: number; growExp: number };

/** 코인으로 분양하는 동물 종류 (값이 있는 종류, 싼 것부터) */
export async function listAdoptable(): Promise<AdoptableSpecies[]> {
  const rows = await db
    .select({ id: animalSpecies.id, code: animalSpecies.code, name: animalSpecies.name, assetKey: animalSpecies.assetKey, price: animalSpecies.price, growExp: animalSpecies.growExp })
    .from(animalSpecies)
    .where(isNotNull(animalSpecies.price))
    .orderBy(asc(animalSpecies.price), asc(animalSpecies.id));
  return rows.map((r) => ({ ...r, price: r.price! }));
}

export type FarmSkin = { id: number; speciesId: number; name: string; price: number; assetKey: string; owned: boolean };

/** 스킨 목록과 내가 산 것 */
export async function listSkins(userId: string): Promise<FarmSkin[]> {
  return db
    .select({
      id: animalSkins.id,
      speciesId: animalSkins.speciesId,
      name: animalSkins.name,
      price: animalSkins.price,
      assetKey: animalSkins.assetKey,
      owned: sql<boolean>`${userAnimalSkins.skinId} IS NOT NULL`,
    })
    .from(animalSkins)
    .leftJoin(userAnimalSkins, and(eq(userAnimalSkins.skinId, animalSkins.id), eq(userAnimalSkins.userId, userId)))
    .orderBy(asc(animalSkins.speciesId), asc(animalSkins.price), asc(animalSkins.id));
}

/** 키우는 중인 알·동물 수 (다 키운 동물은 빼고) */
export async function countActive(tx: Tx, userId: string) {
  const [{ n }] = await tx
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(userAnimals)
    .where(and(eq(userAnimals.userId, userId), inArray(userAnimals.status, ["egg", "growing"])));
  return n;
}

/** 다 자란 동물. special = 특별 진화한 모습의 이름 (보통이면 null) */
export type GrownAnimal = { id: number; name: string; rewardExp: number; rewardCoins: number; special: string | null };

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
    // 특별 진화 (2026-10-12): 다 자라는 순간 낮은 확률로 (src/lib/farm.ts SPECIAL_VARIANTS). 특별한 동물은 스킨을 벗는다 (제 모습이 특별한 색)
    const special = pickSpecial(sp.code, randomInt(1_000_000) / 1_000_000);
    await tx
      .update(userAnimals)
      .set({ status: "grown", growth: sp.growExp, grownAt: new Date(), ...(special ? { variant: special.key, skinId: null } : {}) })
      .where(eq(userAnimals.id, u.id));
    // 다 키운 보상은 종류마다 달라서 REWARD_RULES가 아니라 종류 표의 숫자로 기록한다
    if (sp.rewardExp || sp.rewardCoins) {
      // 경험치가 생기므로 레벨업 알림도 함께 남기는 addLedgerEntry로 (GAME-06 / FR-037)
      await addLedgerEntry(tx, { userId, reason: "farm_grown", expDelta: sp.rewardExp, coinDelta: sp.rewardCoins, refId: u.id });
    }
    grown.push({ id: u.id, name: sp.name, rewardExp: sp.rewardExp, rewardCoins: sp.rewardCoins, special: special?.name ?? null });
  }
  return grown;
}

/** 공개 글로 보상을 받으면 키우는 동물이 모두 자란다 (회의 결정: 글 1개당 동물마다 10) */
export function growForPost(tx: Tx, userId: string) {
  return addGrowth(tx, userId, POST_GROWTH);
}
