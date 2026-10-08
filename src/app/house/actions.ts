"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { houseFurniture, items, userItems } from "@/db/schema";
import { houseInfo, MAX_FURNITURE_SLOTS } from "@/lib/house";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { getWallet, lockUser } from "@/server/points";

export type FurnitureResult = { ok: true } | { ok: false; error: string };

/**
 * 우리 집 칸에 가구를 놓거나(itemId) 비운다(null). 다른 칸에 있던 같은 가구는 이 칸으로 옮긴다.
 * 칸 수는 집 단계(주인 레벨)를 서버에서 다시 계산해 확인한다. 가진 가구만 놓을 수 있다 (house_furniture_owned_fk도 막는다)
 */
export async function placeFurniture(slot: unknown, itemId: unknown): Promise<FurnitureResult> {
  const viewer = await requireMember();
  if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot >= MAX_FURNITURE_SLOTS) {
    return { ok: false, error: "놓을 수 없는 자리예요." };
  }
  const id = itemId === null ? null : parseId(itemId);
  if (itemId !== null && id === null) return { ok: false, error: "가진 가구만 놓을 수 있어요." };

  const result = await db.transaction(async (tx): Promise<FurnitureResult> => {
    await lockUser(tx, viewer.userId);
    const { level } = await getWallet(viewer.userId, tx);
    const { slots, nextLevel } = houseInfo(level);
    if (slot >= slots) {
      return { ok: false, error: nextLevel ? `Lv.${nextLevel}이 되면 집이 커져서 이 자리를 쓸 수 있어요.` : "놓을 수 없는 자리예요." };
    }
    const mySlot = and(eq(houseFurniture.userId, viewer.userId), eq(houseFurniture.slot, slot));
    if (id === null) {
      await tx.delete(houseFurniture).where(mySlot);
      return { ok: true };
    }
    const [owned] = await tx
      .select({ id: items.id })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(and(eq(userItems.userId, viewer.userId), eq(userItems.itemId, id), eq(items.type, "furniture")));
    if (!owned) return { ok: false, error: "가진 가구만 놓을 수 있어요." };

    await tx.delete(houseFurniture).where(and(eq(houseFurniture.userId, viewer.userId), eq(houseFurniture.itemId, id)));
    await tx
      .insert(houseFurniture)
      .values({ userId: viewer.userId, slot, itemId: id })
      .onConflictDoUpdate({ target: [houseFurniture.userId, houseFurniture.slot], set: { itemId: id, placedAt: new Date() } });
    return { ok: true };
  });

  if (result.ok) revalidatePath("/", "layout");
  return result;
}
