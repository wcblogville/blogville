"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { requireMember } from "@/server/dal";
import { lockUser } from "@/server/points";
import { FAVORITE_LIMIT } from "@/server/town";

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
