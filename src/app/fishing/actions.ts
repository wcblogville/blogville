"use server";

import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { fishingCatches, items, userItems } from "@/db/schema";
import { catchCoins, catchPool, type CastTiming, judgeTiming, pickCatch, poolTotal, rollSize } from "@/lib/fishing";
import { FISHING_RULES, kstClock, todayKST } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { checkViolation, uniqueViolation } from "@/server/db-errors";
import { signCast, verifyCast } from "@/server/fishing";
import { addLedgerEntry, lockUser } from "@/server/points";

export type CastResult = { ok: true; token: string; delayMs: number; castNo: number } | { ok: false; error: string };
export type ReelResult =
  | { ok: true; key: string; sizeMm: number | null; coins: number; timing: CastTiming; castNo: number; remaining: number }
  | { ok: false; error: string };

const NO_MORE = "오늘 낚싯대는 다 던졌어요. 내일 다시 와 주세요!";

async function castsToday(userId: string, date: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(fishingCatches)
    .where(and(eq(fishingCatches.userId, userId), eq(fishingCatches.date, date)));
  return n;
}

/**
 * 낚싯대 던지기: 아직 아무것도 기록하지 않는다. 서버가 입질 시각(1.5~4초 뒤)을 정해 서명한 표를 돌려준다.
 * 하루(한국 날짜) FISHING_RULES.castsPerDay(3)번
 */
export async function startCast(): Promise<CastResult> {
  const viewer = await requireMember();
  const date = todayKST();
  const done = await castsToday(viewer.userId, date);
  if (done >= FISHING_RULES.castsPerDay) return { ok: false, error: NO_MORE };
  const [min, max] = FISHING_RULES.biteDelayMs;
  const delayMs = randomInt(min, max + 1);
  const castNo = done + 1;
  return { ok: true, token: signCast({ userId: viewer.userId, date, castNo, biteAt: Date.now() + delayMs }), delayMs, castNo };
}

/**
 * 낚싯대 당기기: 입질 뒤 FISHING_RULES.hitWindowMs 안에 당기면 타이밍 성공(희귀·전설이 잘 나오고 길이도 크게).
 * 일찍·늦게 당겨도 평소 확률로 무언가를 낚는다 (타이밍 없이 바로 당겨도 된다).
 * 코인은 원장 fishing(경험치 0, addLedgerEntry), 먹이는 user_items 수량 +1. lockUser 트랜잭션 안에서 함께 기록한다
 */
export async function reelIn(token: string): Promise<ReelResult> {
  const viewer = await requireMember();
  const now = Date.now();
  const ticket = verifyCast(token, now);
  const today = todayKST();
  if (!ticket || ticket.userId !== viewer.userId || ticket.date !== today) return { ok: false, error: "낚싯줄이 풀렸어요. 다시 던져 주세요." };

  const timing = judgeTiming(now - ticket.biteAt);
  const good = timing === "good";
  const pool = catchPool(kstClock(new Date(now)), good);
  const caught = pickCatch(randomInt(poolTotal(pool)), pool);
  const u = () => randomInt(1_000_000) / 1_000_000;
  const sizeMm = rollSize(caught, u(), good ? u() : undefined);
  const coins = catchCoins(caught, sizeMm);
  try {
    await db.transaction(async (tx) => {
      await lockUser(tx, viewer.userId);
      // PK (user_id, date, cast_no)가 같은 낚싯대를 두 번 받지 못하게 하고, CHECK(cast_no 1~3)가 하루 횟수를 지킨다
      await tx.insert(fishingCatches).values({ userId: viewer.userId, date: today, castNo: ticket.castNo, catchKey: caught.key, coins, sizeMm });
      if (coins > 0) await addLedgerEntry(tx, { userId: viewer.userId, reason: "fishing", coinDelta: coins, refId: `${today}#${ticket.castNo}` });
      if (caught.itemCode) {
        const [item] = await tx.select({ id: items.id }).from(items).where(eq(items.code, caught.itemCode));
        if (item) {
          await tx
            .insert(userItems)
            .values({ userId: viewer.userId, itemId: item.id, quantity: 1 })
            .onConflictDoUpdate({ target: [userItems.userId, userItems.itemId], set: { quantity: sql`${userItems.quantity} + 1` } });
        }
      }
    });
  } catch (err) {
    if (uniqueViolation(err) !== null) return { ok: false, error: "이미 건진 낚싯대예요. 다시 던져 주세요." };
    if (checkViolation(err) === "fishing_catches_cast_no_check") return { ok: false, error: NO_MORE };
    throw err;
  }
  revalidatePath("/", "layout");
  const remaining = Math.max(0, FISHING_RULES.castsPerDay - (await castsToday(viewer.userId, today)));
  return { ok: true, key: caught.key, sizeMm, coins, timing, castNo: ticket.castNo, remaining };
}
