"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { blogs, houseFurniture, items, userItems } from "@/db/schema";
import { isRoofColor } from "@/lib/blog";
import { checkLayout, houseInfo, parseLayout, roomGrid, unlockedRoofs } from "@/lib/house";
import { requireMember } from "@/server/dal";
import { getWallet, lockUser } from "@/server/points";

export type FurnitureResult = { ok: true } | { ok: false; error: string };

/**
 * 우리 집 가구 배치 저장 (사용자 요청 2026-10-12 "편집 들어가서 위치 조정도 마음대로 하고 저장하면 그자리에 놓게").
 * 편집 화면의 배치 전체를 받아 한 트랜잭션에서 내 집 가구를 통째로 바꾼다. 늘 내 집만 바꾼다 (남의 집은 고칠 수 없다).
 * 서버에서 다시 확인: 집 단계(주인 레벨)의 개수·방 크기, 같은 가구 두 번, 가구 크기(차지하는 칸, FURNITURE_FOOTPRINT)가 방 밖이거나 겹치는지(checkLayout), 가진 가구인지.
 * DB도 막는다: 가진 가구(house_furniture_owned_fk), 한 칸 하나(house_furniture_tile_uq), 방 크기 0~9(tile_check)
 */
export async function saveFurnitureLayout(input: unknown): Promise<FurnitureResult> {
  const viewer = await requireMember();
  const spots = parseLayout(input);
  if (!spots) return { ok: false, error: "가구 배치를 읽지 못했어요. 다시 시도해 주세요." };

  const result = await db.transaction(async (tx): Promise<FurnitureResult> => {
    await lockUser(tx, viewer.userId);
    const { level } = await getWallet(viewer.userId, tx);
    const { stage, slots } = houseInfo(level);
    // 가구 크기(차지하는 칸)를 알려면 asset_key가 필요하다: 가진 가구만 읽어 와서 검사하고, 없는 가구가 있으면 막는다
    const owned = spots.length
      ? await tx
          .select({ id: items.id, assetKey: items.assetKey })
          .from(userItems)
          .innerJoin(items, eq(items.id, userItems.itemId))
          .where(and(eq(userItems.userId, viewer.userId), inArray(userItems.itemId, spots.map((s) => s.itemId)), eq(items.type, "furniture")))
      : [];
    const keys = new Map(owned.map((o) => [o.id, o.assetKey]));
    const bad = checkLayout(spots, { grid: roomGrid(stage), limit: slots, keyOf: (id) => keys.get(id) });
    if (bad) return { ok: false, error: bad };
    if (owned.length !== spots.length) return { ok: false, error: "가진 가구만 놓을 수 있어요." };
    await tx.delete(houseFurniture).where(eq(houseFurniture.userId, viewer.userId));
    if (spots.length) {
      await tx
        .insert(houseFurniture)
        .values(spots.map((s) => ({ userId: viewer.userId, itemId: s.itemId, tileX: s.x, tileY: s.y, flipped: s.flip })));
    }
    return { ok: true };
  });

  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/**
 * 지붕 색 고르기 (TOWN-07): 집 단계만큼 열린 색 중에서만 (1단계 1색 … 10단계 10색, 사용자 결정 2026-10-09).
 * 열린 색은 집 단계(주인 레벨)를 서버에서 다시 계산해 확인한다
 */
export async function chooseRoofColor(color: unknown): Promise<FurnitureResult> {
  const viewer = await requireMember();
  if (!isRoofColor(color)) return { ok: false, error: "고를 수 없는 색이에요." };
  const [{ level }, [blog]] = await Promise.all([
    getWallet(viewer.userId),
    db.select({ id: blogs.id }).from(blogs).where(eq(blogs.ownerId, viewer.userId)),
  ]);
  if (!blog) return { ok: false, error: "고를 수 없는 색이에요." };
  if (!unlockedRoofs(blog.id, houseInfo(level).stage).includes(color)) {
    return { ok: false, error: "아직 열리지 않은 색이에요. 집이 한 단계 클 때마다 색이 하나씩 늘어요." };
  }
  await db.update(blogs).set({ roofColor: color }).where(eq(blogs.id, blog.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
