"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { items, pointLedger, userItems } from "@/db/schema";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { getWallet, lockUser } from "@/server/points";

export type BuyResult = { ok: true; name: string } | { ok: false; error: string };

export async function buyItem(itemId: number): Promise<BuyResult> {
  const viewer = await requireMember();

  try {
    const result = await db.transaction(async (tx): Promise<BuyResult> => {
      // 같은 회원의 다른 구매·보상과 겹치지 않게 잠그고 잔액을 계산한다
      await lockUser(tx, viewer.userId);

      const [item] = await tx.select().from(items).where(eq(items.id, itemId));
      if (!item || item.isStarter) return { ok: false, error: "살 수 없는 아이템이에요" };

      const wallet = await getWallet(viewer.userId, tx);
      if (wallet.level < item.requiredLevel) return { ok: false, error: `레벨 ${item.requiredLevel}부터 살 수 있어요` };
      if (wallet.coins < item.price) return { ok: false, error: `코인이 ${item.price - wallet.coins}개 부족해요` };

      // 아이템 지급 (이미 있으면 기본 키 위반 → 전체 취소)
      await tx.insert(userItems).values({ userId: viewer.userId, itemId: item.id });
      await tx.insert(pointLedger).values({
        userId: viewer.userId,
        reason: "purchase",
        coinDelta: -item.price,
        refId: String(item.id),
      });
      return { ok: true, name: item.name };
    });
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    if (uniqueViolation(err) !== null) return { ok: false, error: "이미 가지고 있는 아이템이에요" };
    throw err;
  }
}
