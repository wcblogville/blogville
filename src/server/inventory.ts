import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, items, profiles, userItems } from "@/db/schema";

/** 전체 아이템 + 내가 가졌는지 */
export async function listItemsWithOwnership(userId: string) {
  return db
    .select({
      id: items.id,
      type: items.type,
      name: items.name,
      description: items.description,
      price: items.price,
      requiredLevel: items.requiredLevel,
      isStarter: items.isStarter,
      assetKey: items.assetKey,
      owned: sql<boolean>`${userItems.userId} IS NOT NULL`,
    })
    .from(items)
    .leftJoin(userItems, and(eq(userItems.itemId, items.id), eq(userItems.userId, userId)))
    .orderBy(asc(items.type), asc(items.requiredLevel), asc(items.price), asc(items.id));
}

/** 지금 장착 중인 캐릭터·배경 */
export async function getEquipped(userId: string) {
  const [row] = await db
    .select({ characterItemId: profiles.characterItemId, backgroundItemId: blogs.backgroundItemId })
    .from(profiles)
    .innerJoin(blogs, eq(blogs.ownerId, profiles.userId))
    .where(eq(profiles.userId, userId));
  return row;
}
