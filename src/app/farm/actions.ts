"use server";

import { randomInt } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { animalCares, animalSkins, animalSpecies, pointLedger, userAnimalSkins, userAnimals } from "@/db/schema";
import { CARE_ACTIONS, type CareAction, EGG_PRICE, levelEggLevels, MAX_ACTIVE_ANIMALS, pickWeighted, subject } from "@/lib/farm";
import { todayKST } from "@/lib/game";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { addGrowth, countActive } from "@/server/farm";
import { consumeGrowthItem } from "@/server/inventory";
import { getWallet, grantReward, lockUser } from "@/server/points";

export type FarmResult = { ok: true; text: string } | { ok: false; text: string };

const FULL = `한 번에 ${MAX_ACTIVE_ANIMALS}마리까지 키울 수 있어요. 다 키운 뒤에 새 알을 받아 주세요`;

/** 무료 알 받기: 농장 첫 알(starter) 또는 레벨 보상 알(5레벨마다) */
export async function claimEgg(kind: "starter" | "level", level?: number): Promise<FarmResult> {
  const viewer = await requireMember();
  if (kind !== "starter" && kind !== "level") return { ok: false, text: "잘못된 요청이에요" };
  try {
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, viewer.userId);
      if ((await countActive(tx, viewer.userId)) >= MAX_ACTIVE_ANIMALS) return { ok: false, text: FULL };
      if (kind === "level") {
        const wallet = await getWallet(viewer.userId, tx);
        if (!level || !levelEggLevels(wallet.level).includes(level)) return { ok: false, text: "아직 받을 수 없는 알이에요" };
      }
      await tx.insert(userAnimals).values({
        userId: viewer.userId,
        source: kind,
        sourceLevel: kind === "level" ? level : null,
      });
      return { ok: true, text: "🥚 알을 받았어요! [부화시키기]를 눌러 보세요" };
    });
    revalidatePath("/farm");
    return result;
  } catch (err) {
    // 같은 알을 두 번 받으려 하면 고유 인덱스(starter, level)에 막힌다
    if (uniqueViolation(err) !== null) return { ok: false, text: "이미 받은 알이에요" };
    throw err;
  }
}

/** 코인으로 알 사기 */
export async function buyEgg(): Promise<FarmResult> {
  const viewer = await requireMember();
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    if ((await countActive(tx, viewer.userId)) >= MAX_ACTIVE_ANIMALS) return { ok: false, text: FULL };
    const wallet = await getWallet(viewer.userId, tx);
    if (wallet.coins < EGG_PRICE) return { ok: false, text: `코인이 ${EGG_PRICE - wallet.coins}개 부족해요` };
    const [egg] = await tx.insert(userAnimals).values({ userId: viewer.userId, source: "shop" }).returning({ id: userAnimals.id });
    await tx.insert(pointLedger).values({ userId: viewer.userId, reason: "egg_purchase", coinDelta: -EGG_PRICE, refId: String(egg.id) });
    return { ok: true, text: `🥚 알을 샀어요! (🪙 −${EGG_PRICE})` };
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 알 부화: 종류는 비중에 따라 랜덤 */
export async function hatchEgg(animalId: number): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  if (id === null) return { ok: false, text: "잘못된 요청이에요" };
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    // 분양 동물(hatch_weight 0)은 알에서 나오지 않는다
    const species = await tx.select().from(animalSpecies).where(gt(animalSpecies.hatchWeight, 0));
    if (!species.length) return { ok: false, text: "동물 종류가 없어요. npm run db:seed 를 실행해 주세요" };
    const sp = pickWeighted(species, randomInt(1_000_000) / 1_000_000);
    const [hatched] = await tx
      .update(userAnimals)
      .set({ status: "growing", speciesId: sp.id, hatchedAt: new Date() })
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), eq(userAnimals.status, "egg")))
      .returning({ id: userAnimals.id });
    if (!hatched) return { ok: false, text: "부화시킬 수 있는 알이 아니에요" };
    return { ok: true, text: `🐣 ${subject(sp.name)} 태어났어요!` };
  });
  revalidatePath("/farm");
  return result;
}

/** 돌보기: 동물 한 마리에 같은 돌보기는 하루 한 번. 성장치 + 경험치 조금 */
export async function careAnimal(animalId: number, action: CareAction): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  const care = CARE_ACTIONS.find((c) => c.action === action);
  if (id === null || !care) return { ok: false, text: "잘못된 요청이에요" };
  try {
    const result = await db.transaction(async (tx): Promise<FarmResult> => {
      await lockUser(tx, viewer.userId);
      const [animal] = await tx
        .select({ id: userAnimals.id })
        .from(userAnimals)
        .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), eq(userAnimals.status, "growing")));
      if (!animal) return { ok: false, text: "돌볼 수 있는 동물이 아니에요" };
      await tx.insert(animalCares).values({ animalId: id, action, date: todayKST() });
      await grantReward(tx, viewer.userId, "farm_care", id);
      const [grown] = await addGrowth(tx, viewer.userId, care.growth, [id]);
      if (grown) {
        return { ok: true, text: `🎉 ${subject(grown.name)} 다 자랐어요! 경험치 +${grown.rewardExp}, 🪙 +${grown.rewardCoins}` };
      }
      return { ok: true, text: `${care.emoji} ${care.label} 완료! 성장 +${care.growth}` };
    });
    revalidatePath("/", "layout");
    return result;
  } catch (err) {
    if (uniqueViolation(err) !== null) return { ok: false, text: `오늘은 이미 ${care.label}를 했어요` };
    throw err;
  }
}

/** 성장 아이템 쓰기 (SHOP FR-044): 상점에서 산 먹이 하나를 줄이고 그만큼 성장. 하루 횟수 제한은 없다 */
export async function feedGrowthItem(animalId: unknown, itemId: unknown): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  const item = parseId(itemId);
  if (id === null || item === null) return { ok: false, text: "잘못된 요청이에요" };
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    const [animal] = await tx
      .select({ id: userAnimals.id })
      .from(userAnimals)
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId), eq(userAnimals.status, "growing")));
    if (!animal) return { ok: false, text: "먹일 수 있는 동물이 아니에요" };
    const used = await consumeGrowthItem(tx, viewer.userId, item);
    if (!used) return { ok: false, text: "가지고 있는 성장 아이템이 없어요" };
    const [grown] = await addGrowth(tx, viewer.userId, used.growthValue, [id]);
    if (grown) {
      return { ok: true, text: `🎉 ${subject(grown.name)} 다 자랐어요! 경험치 +${grown.rewardExp}, 🪙 +${grown.rewardCoins}` };
    }
    return { ok: true, text: `🌱 ${used.name} 먹였어요! 성장 +${used.growthValue}` };
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/**
 * 동물 분양 (사용자 요청 2026-10-11 "펫 종류"): 코인으로 값이 있는 종류의 아기를 바로 데려온다 (알 없이 키우는 중으로).
 * 키우는 자리(MAX_ACTIVE_ANIMALS)를 함께 쓴다. 원장 사유 animal_adopt (경험치 0이라 직접 INSERT)
 */
export async function adoptAnimal(speciesId: unknown): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(speciesId);
  if (id === null) return { ok: false, text: "잘못된 요청이에요" };
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    const [sp] = await tx.select().from(animalSpecies).where(eq(animalSpecies.id, id));
    if (!sp || sp.price === null) return { ok: false, text: "분양하지 않는 동물이에요" };
    if ((await countActive(tx, viewer.userId)) >= MAX_ACTIVE_ANIMALS) return { ok: false, text: FULL };
    const wallet = await getWallet(viewer.userId, tx);
    if (wallet.coins < sp.price) return { ok: false, text: `코인이 ${sp.price - wallet.coins}개 부족해요` };
    const [animal] = await tx
      .insert(userAnimals)
      .values({ userId: viewer.userId, speciesId: sp.id, status: "growing", source: "adopt", hatchedAt: new Date() })
      .returning({ id: userAnimals.id });
    await tx.insert(pointLedger).values({ userId: viewer.userId, reason: "animal_adopt", coinDelta: -sp.price, refId: String(animal.id) });
    return { ok: true, text: `🐾 ${subject(sp.name)} 왔어요! (🪙 −${sp.price})` };
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/**
 * 스킨 입히기 (사용자 요청 2026-10-11 "펫 종류별로 스킨"). skinId가 null이면 기본 색으로.
 * 아직 안 산 스킨이면 코인으로 사고(user_animal_skins + 원장 skin_purchase) 바로 입힌다. 한 번 산 스킨은 그 종류의 내 동물 모두에게 쓸 수 있다
 */
export async function wearSkin(animalId: unknown, skinId: unknown): Promise<FarmResult> {
  const viewer = await requireMember();
  const id = parseId(animalId);
  const skin = skinId === null ? null : parseId(skinId);
  if (id === null || (skinId !== null && skin === null)) return { ok: false, text: "잘못된 요청이에요" };
  const result = await db.transaction(async (tx): Promise<FarmResult> => {
    await lockUser(tx, viewer.userId);
    const [animal] = await tx
      .select({ id: userAnimals.id, speciesId: userAnimals.speciesId })
      .from(userAnimals)
      .where(and(eq(userAnimals.id, id), eq(userAnimals.userId, viewer.userId)));
    if (!animal || animal.speciesId === null) return { ok: false, text: "스킨을 입힐 수 있는 동물이 아니에요" };
    if (skin === null) {
      await tx.update(userAnimals).set({ skinId: null }).where(eq(userAnimals.id, id));
      return { ok: true, text: "기본 색으로 돌아왔어요" };
    }
    const [row] = await tx
      .select({ id: animalSkins.id, name: animalSkins.name, price: animalSkins.price, owned: userAnimalSkins.skinId })
      .from(animalSkins)
      .leftJoin(userAnimalSkins, and(eq(userAnimalSkins.skinId, animalSkins.id), eq(userAnimalSkins.userId, viewer.userId)))
      .where(and(eq(animalSkins.id, skin), eq(animalSkins.speciesId, animal.speciesId)));
    if (!row) return { ok: false, text: "이 동물에게 맞는 스킨이 아니에요" };
    let bought = false;
    if (row.owned === null) {
      const wallet = await getWallet(viewer.userId, tx);
      if (wallet.coins < row.price) return { ok: false, text: `코인이 ${row.price - wallet.coins}개 부족해요` };
      await tx.insert(userAnimalSkins).values({ userId: viewer.userId, skinId: row.id });
      await tx.insert(pointLedger).values({ userId: viewer.userId, reason: "skin_purchase", coinDelta: -row.price, refId: String(row.id) });
      bought = true;
    }
    await tx.update(userAnimals).set({ skinId: row.id }).where(eq(userAnimals.id, id));
    return { ok: true, text: bought ? `🎨 ${row.name} 스킨을 사서 입혔어요! (🪙 −${row.price})` : `🎨 ${row.name} 스킨을 입혔어요` };
  });
  // 코인·광장 동물·블로그 방 동물이 바뀐다
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
