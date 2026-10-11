import "server-only";
import { and, asc, eq, gt, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { avatarEquips, blogs, items, profiles, userItems } from "@/db/schema";
import type { AvatarSlot } from "@/lib/art/avatar";
import type { ShopItem } from "@/lib/shop";
import type { Tx } from "@/server/points";

/** 그 회원이 입은 아바타 asset_key 목록 (SHOP-06). select에 넣어 쓰는 SQL 조각 */
export function outfitOf(userIdColumn: AnyPgColumn | SQL): SQL<string[]> {
  return sql<string[]>`ARRAY(
    SELECT i.asset_key FROM ${avatarEquips} ae JOIN ${items} i ON i.id = ae.item_id WHERE ae.user_id = ${userIdColumn} ORDER BY ae.slot
  )`;
}

/** 상점 목록: 판매 중인 것만, 내 수량(없으면 0)과 가진 회원 수 (contracts/shop.md 1.1). 머리 모양·머리 색은 미용실에서만 판다 (SHOP-07) */
export async function listShopItems(userId: string): Promise<ShopItem[]> {
  const owners = db
    .select({ itemId: userItems.itemId, n: sql<number>`COUNT(*)::int`.as("n") })
    .from(userItems)
    .where(gt(userItems.quantity, 0))
    .groupBy(userItems.itemId)
    .as("owners");
  return db
    .select({
      id: items.id,
      type: items.type,
      name: items.name,
      description: items.description,
      price: items.price,
      requiredLevel: items.requiredLevel,
      assetKey: items.assetKey,
      quantity: sql<number>`COALESCE(${userItems.quantity}, 0)::int`,
      ownerCount: sql<number>`COALESCE(${owners.n}, 0)::int`,
    })
    .from(items)
    .leftJoin(userItems, and(eq(userItems.itemId, items.id), eq(userItems.userId, userId)))
    .leftJoin(owners, eq(owners.itemId, items.id))
    .where(
      and(
        eq(items.isOnSale, true),
        ne(items.type, "character"),
        or(isNull(items.avatarSlot), notInArray(items.avatarSlot, ["hair", "hair_color"])),
      ),
    )
    .orderBy(asc(items.requiredLevel), asc(items.price), asc(items.id));
}

export type OwnedItem = { id: number; type: ShopItem["type"]; name: string; assetKey: string; avatarSlot: AvatarSlot | null };

/** 꾸미기 목록: 가진 것(수량 > 0)만, 성장 아이템 제외, 판매를 멈춘 것도 포함 (contracts/closet.md 1.1, D12) */
export async function listOwnedItems(userId: string): Promise<OwnedItem[]> {
  return db
    .select({ id: items.id, type: items.type, name: items.name, assetKey: items.assetKey, avatarSlot: items.avatarSlot })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.userId, userId), gt(userItems.quantity, 0), ne(items.type, "growth")))
    .orderBy(asc(items.requiredLevel), asc(items.price), asc(items.id));
}

/** 지금 장착 중인 캐릭터·배경과 부위별 아바타 */
export async function getEquipped(userId: string) {
  const [[row], worn] = await Promise.all([
    db
      .select({ characterItemId: profiles.characterItemId, backgroundItemId: blogs.backgroundItemId })
      .from(profiles)
      .innerJoin(blogs, eq(blogs.ownerId, profiles.userId))
      .where(eq(profiles.userId, userId)),
    db.select({ slot: avatarEquips.slot, itemId: avatarEquips.itemId }).from(avatarEquips).where(eq(avatarEquips.userId, userId)),
  ]);
  const avatar: Partial<Record<AvatarSlot, number>> = {};
  for (const w of worn) avatar[w.slot] = w.itemId;
  return { ...row, avatar };
}

/**
 * 동물 농장에서 성장 아이템을 하나 쓴다 (FR-044, town TOWN-09가 부른다).
 * 부르는 쪽이 lockUser를 건 트랜잭션 안에서 부른다. 성장 아이템이고 수량이 있을 때만 1 줄이고, 아니면 null. 원장은 쓰지 않는다
 */
export async function consumeGrowthItem(tx: Tx, userId: string, itemId: number) {
  const [row] = await tx
    .update(userItems)
    .set({ quantity: sql`${userItems.quantity} - 1` })
    .from(items)
    .where(
      and(
        eq(userItems.userId, userId),
        eq(userItems.itemId, itemId),
        gt(userItems.quantity, 0),
        eq(items.id, userItems.itemId),
        eq(items.type, "growth"),
      ),
    )
    .returning({ name: items.name, growthValue: items.growthValue });
  return row ? { name: row.name, growthValue: row.growthValue ?? 0 } : null;
}

/** 내가 가진 성장 아이템 (농장에서 쓰기) */
export async function listGrowthItems(userId: string) {
  return db
    .select({ id: items.id, name: items.name, assetKey: items.assetKey, growthValue: items.growthValue, quantity: userItems.quantity })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.userId, userId), eq(items.type, "growth"), gt(userItems.quantity, 0)))
    .orderBy(asc(items.price), asc(items.id));
}
