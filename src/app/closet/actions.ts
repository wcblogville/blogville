"use server";

import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { avatarEquips, blogs, items, profiles, userItems } from "@/db/schema";
import { parseId } from "@/lib/ids";
import { CLOSET_ERRORS } from "@/lib/shop";
import { requireMember } from "@/server/dal";

type Result = { ok: boolean; error?: string };

/** 꾸미기 장착 (SHOP-04·06, contracts/closet.md 2장). 복합 외래 키가 "가진 것만 장착"을 DB에서 한 번 더 막는다 */
export async function equipItem(itemId: unknown): Promise<Result> {
  const viewer = await requireMember();
  const id = parseId(itemId);
  if (id === null) return { ok: false, error: CLOSET_ERRORS.notOwned };

  const [owned] = await db
    .select({ type: items.type, avatarSlot: items.avatarSlot })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.userId, viewer.userId), eq(userItems.itemId, id), gt(userItems.quantity, 0)));
  if (!owned) return { ok: false, error: CLOSET_ERRORS.notOwned };

  if (owned.type === "character") {
    await db.update(profiles).set({ characterItemId: id }).where(eq(profiles.userId, viewer.userId));
  } else if (owned.type === "background") {
    await db.update(blogs).set({ backgroundItemId: id }).where(eq(blogs.ownerId, viewer.userId));
  } else if (owned.type === "avatar" && owned.avatarSlot) {
    // 부위마다 하나: 같은 부위를 입고 있으면 바꾼다
    await db
      .insert(avatarEquips)
      .values({ userId: viewer.userId, slot: owned.avatarSlot, itemId: id })
      .onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId: id } });
  } else {
    return { ok: false, error: CLOSET_ERRORS.cannotEquip };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 입고 있는 아바타 아이템 벗기 (그 아이템이 장착된 부위를 비운다) */
export async function unequipAvatar(itemId: unknown): Promise<Result> {
  const viewer = await requireMember();
  const id = parseId(itemId);
  if (id === null) return { ok: false, error: CLOSET_ERRORS.notOwned };
  await db.delete(avatarEquips).where(and(eq(avatarEquips.userId, viewer.userId), eq(avatarEquips.itemId, id)));
  revalidatePath("/", "layout");
  return { ok: true };
}
