"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { posts, profiles, users } from "@/db/schema";
import { expToMaxLevel, parseGrantInput } from "@/lib/admin-grant";
import { parseId } from "@/lib/ids";
import { normalizeName } from "@/lib/names";
import { requireAdmin } from "@/server/dal";
import { newTempPassword, setMemberPassword } from "@/server/password-reset";
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

export type AdminResetPasswordState =
  | { ok?: undefined; error?: undefined }
  | { ok: false; error: string }
  | { ok: true; username: string; nickname: string | null; tempPassword: string; at: number };

const ADMIN_RESET_ERRORS = {
  empty: "회원 아이디를 적어 주세요",
  notFound: (username: string) => `'${username}' 아이디의 회원이 없어요`,
  self: "내 계정은 여기서 초기화할 수 없어요. 회원정보 수정에서 바꿔 주세요",
  failed: "비밀번호를 초기화하지 못했어요. 다시 시도해 주세요",
} as const;

/**
 * 관리자 비밀번호 초기화 (AUTH-12 비밀번호 찾기, 간편 로그인을 연동하지 않은 회원용).
 * 임시 비밀번호(12자, node:crypto)를 만들어 그 회원의 아이디 로그인 비밀번호로 정하고, 그 회원의 로그인을 모두 끊는다.
 * 임시 비밀번호는 이 응답으로 관리자에게 한 번만 보인다. 저장·기록하지 않는다 (DB에는 해시만).
 * 관리자 자신은 막는다 (내 비밀번호는 회원정보 수정에서 바꾼다).
 */
export async function adminResetPassword(_prev: AdminResetPasswordState, form: FormData): Promise<AdminResetPasswordState> {
  const admin = await requireAdmin();
  const username = normalizeName(String(form.get("username") ?? ""));
  if (!username) return { ok: false, error: ADMIN_RESET_ERRORS.empty };
  if (username.length > 64) return { ok: false, error: ADMIN_RESET_ERRORS.notFound(username.slice(0, 20)) };

  const [target] = await db
    .select({ id: users.id, username: users.username, nickname: profiles.nickname })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.username, username))
    .limit(1);
  if (!target) return { ok: false, error: ADMIN_RESET_ERRORS.notFound(username) };
  if (target.id === admin.userId) return { ok: false, error: ADMIN_RESET_ERRORS.self };

  const tempPassword = newTempPassword();
  try {
    await setMemberPassword(target.id, tempPassword);
  } catch (err) {
    console.error("관리자 비밀번호 초기화 실패", target.id, err);
    return { ok: false, error: ADMIN_RESET_ERRORS.failed };
  }
  return { ok: true, username: target.username ?? username, nickname: target.nickname, tempPassword, at: Date.now() };
}
