"use server";

import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { animalCares, animalSpecies, pointLedger, userAnimals } from "@/db/schema";
import { CARE_ACTIONS, type CareAction, EGG_PRICE, levelEggLevels, MAX_ACTIVE_ANIMALS, pickWeighted, subject } from "@/lib/farm";
import { todayKST } from "@/lib/game";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { addGrowth, countActive } from "@/server/farm";
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
    const species = await tx.select().from(animalSpecies);
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
