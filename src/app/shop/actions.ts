"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { items, pointLedger, userItems } from "@/db/schema";
import { parseId } from "@/lib/ids";
import { parseCount, SHOP_ERRORS, shortage } from "@/lib/shop";
import { requireMember } from "@/server/dal";
import { uniqueViolation } from "@/server/db-errors";
import { getWallet, lockUser } from "@/server/points";

export type BuyResult = { ok: true; name: string; kind: "decor" | "growth"; quantity: number; count: number } | { ok: false; error: string };

/**
 * 상점 [사기] (SHOP-01·02·03, contracts/shop.md 2장).
 * 잠금 안에서 그 순간의 값으로 확인한다: 판매 여부 → 보유(꾸미기) → 레벨 → 코인. 지급과 원장 차감은 한 트랜잭션.
 * 꾸미기 아이템(아바타·가구·배경)은 하나만, 성장 아이템은 한 번에 count개(1~MAX_BULK, 2026-10-16)까지 사서 수량 +count.
 * 여러 개를 사도 원장은 한 줄 (코인 −가격×개수)
 */
export async function buyItem(itemId: unknown, countRaw?: unknown): Promise<BuyResult> {
  const viewer = await requireMember();
  const id = parseId(itemId);
  if (id === null) return { ok: false, error: SHOP_ERRORS.notForSale };
  const count = parseCount(countRaw);
  if (count === null) return { ok: false, error: SHOP_ERRORS.count };

  try {
    const result = await db.transaction(async (tx): Promise<BuyResult> => {
      // 같은 회원의 다른 구매·보상과 겹치지 않게 잠그고 잔액을 계산한다
      await lockUser(tx, viewer.userId);

      const [item] = await tx.select().from(items).where(eq(items.id, id));
      if (!item || !item.isOnSale || item.isStarter || item.type === "character") return { ok: false, error: SHOP_ERRORS.notForSale };
      const growth = item.type === "growth";
      if (!growth && count !== 1) return { ok: false, error: SHOP_ERRORS.count };
      const cost = item.price * count;

      const [held] = await tx
        .select({ quantity: userItems.quantity })
        .from(userItems)
        .where(and(eq(userItems.userId, viewer.userId), eq(userItems.itemId, item.id)));
      if (!growth && held && held.quantity > 0) return { ok: false, error: SHOP_ERRORS.owned };

      const wallet = await getWallet(viewer.userId, tx);
      if (wallet.level < item.requiredLevel) return { ok: false, error: SHOP_ERRORS.level(item.requiredLevel) };
      if (wallet.coins < cost) return { ok: false, error: SHOP_ERRORS.coins(shortage(cost, wallet.coins)) };

      // 지급: 성장 아이템은 수량 +count (처음 얻은 시각은 그대로), 꾸미기 아이템은 새 행 (있으면 PK 위반 → 전체 취소)
      let quantity = 1;
      if (growth) {
        const [row] = await tx
          .insert(userItems)
          .values({ userId: viewer.userId, itemId: item.id, quantity: count })
          .onConflictDoUpdate({ target: [userItems.userId, userItems.itemId], set: { quantity: sql`${userItems.quantity} + ${count}` } })
          .returning({ quantity: userItems.quantity });
        quantity = row.quantity;
      } else if (held) {
        // 수량 0으로 남은 꾸미기 행 (지금은 생기지 않지만 보유 정의 quantity > 0에 맞춘다)
        await tx.update(userItems).set({ quantity: 1 }).where(and(eq(userItems.userId, viewer.userId), eq(userItems.itemId, item.id)));
      } else {
        await tx.insert(userItems).values({ userId: viewer.userId, itemId: item.id });
      }
      await tx.insert(pointLedger).values({ userId: viewer.userId, reason: "purchase", coinDelta: -cost, refId: String(item.id) });
      return { ok: true, name: item.name, kind: growth ? "growth" : "decor", quantity, count };
    });
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (err) {
    if (uniqueViolation(err) !== null) return { ok: false, error: SHOP_ERRORS.owned };
    throw err;
  }
}
