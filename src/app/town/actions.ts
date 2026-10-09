"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { follows, items, townDecorations, userItems, users } from "@/db/schema";
import { decorationSlots, decoSlotLevel, MAX_DECO_SLOTS } from "@/lib/house";
import { parseId } from "@/lib/ids";
import { withJosa } from "@/lib/josa";
import type { TownDecoration } from "@/components/town/types";
import { requireMember } from "@/server/dal";
import { getWallet, lockUser } from "@/server/points";
import { FAVORITE_LIMIT, getDecorations } from "@/server/town";

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
    await tx.update(follows).set({ isFavorite: !row.isFavorite }).where(mine);
    return { ok: true, isFavorite: !row.isFavorite };
  });

  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export type DecorationResult = { ok: true; decorations: TownDecoration[] } | { ok: false; error: string };

/**
 * 광장 꾸미기 (사용자 요청 2026-10-09): 내 광장의 꾸미기 자리에 장식을 놓거나(itemId) 비운다(null).
 * 다른 자리에 있던 같은 장식은 이 자리로 옮긴다. 자리 수는 집 단계(주인 레벨)를 서버에서 다시 계산해 확인하고,
 * 가진 장식만 놓을 수 있다 (town_decorations_owned_fk도 막는다).
 * 페이지를 다시 그리면 광장 게임이 처음부터 다시 만들어지므로 revalidate하지 않고, 바뀐 목록을 돌려줘 게임이 바로 그린다
 */
export async function placeDecoration(slot: unknown, itemId: unknown): Promise<DecorationResult> {
  const viewer = await requireMember();
  if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot >= MAX_DECO_SLOTS) {
    return { ok: false, error: "놓을 수 없는 자리예요." };
  }
  const id = itemId === null ? null : parseId(itemId);
  if (itemId !== null && id === null) return { ok: false, error: "가진 장식만 놓을 수 있어요." };

  return db.transaction(async (tx): Promise<DecorationResult> => {
    await lockUser(tx, viewer.userId);
    const { level } = await getWallet(viewer.userId, tx);
    if (slot >= decorationSlots(level)) {
      return { ok: false, error: `${withJosa(`Lv.${decoSlotLevel(slot)}`, "이/가")} 되면 집이 커져서 이 자리를 쓸 수 있어요.` };
    }
    const mySlot = and(eq(townDecorations.userId, viewer.userId), eq(townDecorations.slot, slot));
    if (id === null) {
      await tx.delete(townDecorations).where(mySlot);
    } else {
      const [owned] = await tx
        .select({ id: items.id })
        .from(userItems)
        .innerJoin(items, eq(items.id, userItems.itemId))
        .where(and(eq(userItems.userId, viewer.userId), eq(userItems.itemId, id), eq(items.type, "deco")));
      if (!owned) return { ok: false, error: "가진 장식만 놓을 수 있어요." };
      await tx.delete(townDecorations).where(and(eq(townDecorations.userId, viewer.userId), eq(townDecorations.itemId, id)));
      await tx
        .insert(townDecorations)
        .values({ userId: viewer.userId, slot, itemId: id })
        .onConflictDoUpdate({ target: [townDecorations.userId, townDecorations.slot], set: { itemId: id, placedAt: new Date() } });
    }
    return { ok: true, decorations: await getDecorations(viewer.userId, tx) };
  });
}
