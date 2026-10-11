"use server";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { requireMember } from "@/server/dal";
import { lockUser } from "@/server/points";
import { FAVORITE_LIMIT } from "@/server/town";
import { assignLots, isNeighborLot, NEIGHBOR_LOTS } from "@/lib/town-lots";

export type FavoriteResult = { ok: true; isFavorite: boolean } | { ok: false; error: string };

/**
 * 친구 목록의 ⭐: 즐겨찾기를 켜거나 끈다. 즐겨찾기한 이웃의 집이 마을 둘레에 선다 (최대 10채).
 * 이미 이웃으로 추가한 사람만 즐겨찾기할 수 있다. 같은 회원의 요청은 lockUser로 줄 세워 10명을 넘지 않게 한다
 */
export async function toggleFavorite(followeeId: unknown): Promise<FavoriteResult> {
  const viewer = await requireMember();
  if (typeof followeeId !== "string" || followeeId.length < 1 || followeeId.length > 64) {
    return { ok: false, error: "이웃을 찾을 수 없어요." };
  }

  const result = await db.transaction(async (tx): Promise<FavoriteResult> => {
    await lockUser(tx, viewer.userId);
    const mine = and(eq(follows.followerId, viewer.userId), eq(follows.followeeId, followeeId));
    const [row] = await tx.select({ isFavorite: follows.isFavorite }).from(follows).where(mine);
    if (!row) return { ok: false, error: "이웃으로 추가한 사람만 즐겨찾기할 수 있어요." };

    if (!row.isFavorite) {
      // 공지 블로그(관리자)는 남의 마을에 집이 서지 않는다. ⭐를 켜면 10자리 중 하나만 차지한다 (끄는 것은 된다)
      const [admin] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, followeeId), eq(users.role, "admin")));
      if (admin) return { ok: false, error: "공지사항 블로그는 마을에 집이 없어서 즐겨찾기할 수 없어요." };
      const [{ n }] = await tx
        .select({ n: count() })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewer.userId),
            eq(follows.isFavorite, true),
            sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${follows.followeeId} AND ${users.role} = 'admin')`,
          ),
        );
      if (n >= FAVORITE_LIMIT) return { ok: false, error: `즐겨찾기는 ${FAVORITE_LIMIT}명까지예요. 다른 이웃의 ⭐를 먼저 꺼 주세요.` };
    }
    // 즐겨찾기를 끄면 골라 둔 집 자리도 비운다 (TOWN-18)
    await tx.update(follows).set(row.isFavorite ? { isFavorite: false, townLot: null } : { isFavorite: true }).where(mine);
    return { ok: true, isFavorite: !row.isFavorite };
  });

  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export type TownLotResult = { ok: true } | { ok: false; error: string };

/**
 * 이웃 집 자리 고르기 (TOWN-18, 사용자 요청 2026-10-11): 내 마을의 lot번(1~10) 자리에 즐겨찾기 이웃 followeeId를 둔다.
 * 그 자리에 다른 이웃이 있으면(골라 둔 자리든 차례로 받은 자리든) 두 이웃의 자리를 맞바꾼다.
 * 내가 ⭐ 즐겨찾기한 이웃만, 공지 블로그는 안 된다. 같은 회원의 요청은 lockUser로 줄 세운다
 */
export async function setTownLot(followeeId: unknown, lot: unknown): Promise<TownLotResult> {
  const viewer = await requireMember();
  if (!isNeighborLot(lot)) return { ok: false, error: `이웃 집 자리는 1~${NEIGHBOR_LOTS}번이에요.` };
  if (typeof followeeId !== "string" || followeeId.length < 1 || followeeId.length > 64) {
    return { ok: false, error: "이웃을 찾을 수 없어요." };
  }

  const result = await db.transaction(async (tx): Promise<TownLotResult> => {
    await lockUser(tx, viewer.userId);
    // 지금 마을의 자리 (서버 town.ts getFavoriteHouses와 같은 순서·같은 나누기)
    const favorites = await tx
      .select({ followeeId: follows.followeeId, townLot: follows.townLot })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewer.userId),
          eq(follows.isFavorite, true),
          sql`NOT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${follows.followeeId} AND ${users.role} = 'admin')`,
        ),
      )
      .orderBy(asc(follows.createdAt), asc(follows.followeeId))
      .limit(FAVORITE_LIMIT);
    const placed = assignLots(favorites);
    const me = placed.find((f) => f.followeeId === followeeId);
    if (!me) return { ok: false, error: "⭐ 즐겨찾기한 이웃만 집 자리를 고를 수 있어요." };
    if (me.lot === lot) return { ok: true };
    const other = placed.find((f) => f.lot === lot);
    const of = (id: string) => and(eq(follows.followerId, viewer.userId), eq(follows.followeeId, id));
    // 같은 자리가 잠깐이라도 겹치지 않게 먼저 비우고 다시 놓는다 (follows_town_lot_uq)
    await tx.update(follows).set({ townLot: null }).where(of(followeeId));
    if (other) {
      await tx.update(follows).set({ townLot: me.lot }).where(of(other.followeeId));
    }
    await tx.update(follows).set({ townLot: lot }).where(of(followeeId));
    return { ok: true };
  });

  if (result.ok) revalidatePath("/", "layout");
  return result;
}
