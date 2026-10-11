"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { posts, profiles, users } from "@/db/schema";
import { expToMaxLevel, parseGrantInput } from "@/lib/admin-grant";
import { parseId } from "@/lib/ids";
import { requireAdmin } from "@/server/dal";
import { addLedgerEntry, getWallet, lockUser } from "@/server/points";

/** 관리자: 어느 블로그의 글이든 삭제 */
export async function adminDeletePost(postId: number) {
  await requireAdmin();
  if (parseId(postId) === null) return;
  await db.delete(posts).where(eq(posts.id, postId));
  revalidatePath("/", "layout");
}

export type AdminGrantState =
  | { ok?: undefined; error?: undefined }
  | { ok: false; error: string }
  | {
      ok: true;
      username: string;
      nickname: string | null;
      coinsGranted: number;
      expGranted: number;
      levelUps: number;
      coins: number;
      exp: number;
      level: number;
    };

/**
 * 관리자 테스트 지급 (AUTH-10): 회원에게 코인·경험치를 원장(`admin_grant`)으로 준다.
 * 경험치는 addLedgerEntry로 넣어 레벨이 오르면 같은 트랜잭션에 level_up 알림이 생긴다.
 * requireAdmin()은 자동 출석 기록 때문에 트랜잭션 밖, 맨 앞에서 부른다.
 */
export async function adminGrant(_prev: AdminGrantState, form: FormData): Promise<AdminGrantState> {
  const admin = await requireAdmin();
  const input = parseGrantInput(form);
  if ("error" in input) return { ok: false, error: input.error };

  // 빈 칸이면 관리자 자신
  const [target] = await db
    .select({ id: users.id, username: users.username, nickname: profiles.nickname })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(input.username ? eq(users.username, input.username) : eq(users.id, admin.userId))
    .limit(1);
  if (!target) return { ok: false, error: `'${input.username}' 아이디의 회원이 없어요` };

  const result = await db.transaction(async (tx) => {
    await lockUser(tx, target.id);
    let exp = input.exp;
    if (input.preset === "max_level") exp = expToMaxLevel((await getWallet(target.id, tx)).exp);
    const { levelUps } =
      exp > 0 || input.coins > 0
        ? await addLedgerEntry(tx, { userId: target.id, reason: "admin_grant", expDelta: exp, coinDelta: input.coins, refId: admin.userId })
        : { levelUps: [] };
    const wallet = await getWallet(target.id, tx);
    return { exp, levelUps: levelUps.length, wallet };
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    username: target.username ?? target.id,
    nickname: target.nickname,
    coinsGranted: input.coins,
    expGranted: result.exp,
    levelUps: result.levelUps,
    coins: result.wallet.coins,
    exp: result.wallet.exp,
    level: result.wallet.level,
  };
}
