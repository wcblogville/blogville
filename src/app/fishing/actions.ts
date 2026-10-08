"use server";

import { randomInt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { fishingCatches, items, userItems } from "@/db/schema";
import { pickCatch } from "@/lib/fishing";
import { todayKST } from "@/lib/game";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { addLedgerEntry, lockUser } from "@/server/points";

export type FishResult = { ok: true; key: string } | { ok: false; error: string };

/** 낚싯대 던지기: 하루(한국 날짜) 한 번. 코인은 원장 fishing, 먹이는 user_items 수량 +1 */
export async function castLine(): Promise<FishResult> {
  const viewer = await requireMember();
  const today = todayKST();
  const caught = pickCatch(randomInt(100));
  try {
    await db.transaction(async (tx) => {
      await lockUser(tx, viewer.userId);
      // PK (user_id, date)가 하루 한 번을 지킨다 (동시에 눌러도 하나만)
      await tx.insert(fishingCatches).values({ userId: viewer.userId, date: today, catchKey: caught.key, coins: caught.coins });
      if (caught.coins > 0) await addLedgerEntry(tx, { userId: viewer.userId, reason: "fishing", coinDelta: caught.coins, refId: today });
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
    if (uniqueViolation(err) !== null) return { ok: false, error: "오늘은 이미 낚시했어요. 내일 다시 와 주세요!" };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: true, key: caught.key };
}
