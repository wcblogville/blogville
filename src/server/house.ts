import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { houseFurniture, items, userItems } from "@/db/schema";

export type PlacedFurniture = { slot: number; itemId: number; name: string; assetKey: string };
export type OwnedFurniture = { id: number; name: string; assetKey: string };

/** 집 안에 놓인 가구 (칸 순서) */
export async function getPlacedFurniture(userId: string): Promise<PlacedFurniture[]> {
  return db
    .select({ slot: houseFurniture.slot, itemId: houseFurniture.itemId, name: items.name, assetKey: items.assetKey })
    .from(houseFurniture)
    .innerJoin(items, eq(items.id, houseFurniture.itemId))
    .where(eq(houseFurniture.userId, userId))
    .orderBy(asc(houseFurniture.slot));
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
