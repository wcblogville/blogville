"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { blogs, items, profiles, userItems } from "@/db/schema";
import { requireMember } from "@/server/dal";

export async function equipItem(itemId: number): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireMember();

  const [owned] = await db
    .select({ type: items.type })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.userId, viewer.userId), eq(userItems.itemId, itemId)));
  if (!owned) return { ok: false, error: "가지고 있지 않은 아이템이에요" };

  // 복합 외래 키가 "보유한 아이템만 장착"을 DB에서 한 번 더 막아 준다
  if (owned.type === "character") {
    await db.update(profiles).set({ characterItemId: itemId }).where(eq(profiles.userId, viewer.userId));
  } else if (owned.type === "background") {
    await db.update(blogs).set({ backgroundItemId: itemId }).where(eq(blogs.ownerId, viewer.userId));
  } else {
    return { ok: false, error: "아직 장착할 수 없는 종류예요" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
