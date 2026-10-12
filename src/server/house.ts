import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { houseFurniture, items, userItems } from "@/db/schema";

/** 놓인 가구: 바닥 칸(x, y)과 좌우 뒤집기 */
export type PlacedFurniture = { itemId: number; name: string; assetKey: string; x: number; y: number; flip: boolean };
export type OwnedFurniture = { id: number; name: string; assetKey: string };

/** 집 안에 놓인 가구 (뒤 → 앞 순서: 화면에서 겹칠 때 앞 칸이 위) */
export async function getPlacedFurniture(userId: string): Promise<PlacedFurniture[]> {
  return db
    .select({
      itemId: houseFurniture.itemId,
      name: items.name,
      assetKey: items.assetKey,
      x: houseFurniture.tileX,
      y: houseFurniture.tileY,
      flip: houseFurniture.flipped,
    })
    .from(houseFurniture)
    .innerJoin(items, eq(items.id, houseFurniture.itemId))
    .where(eq(houseFurniture.userId, userId))
    .orderBy(asc(sql`${houseFurniture.tileX} + ${houseFurniture.tileY}`), asc(houseFurniture.tileX));
}

/** 가진 가구 (가구 놓기 목록) */
export async function getOwnedFurniture(userId: string): Promise<OwnedFurniture[]> {
  return db
    .select({ id: items.id, name: items.name, assetKey: items.assetKey })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.userId, userId), eq(items.type, "furniture")))
    .orderBy(asc(items.requiredLevel), asc(items.price), asc(items.id));
}
