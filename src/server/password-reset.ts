// 비밀번호 새로 정하기 (AUTH-12): 지금 비밀번호 없이 아이디 로그인 비밀번호를 바꾼다.
// 쓰는 곳은 둘이다. 간편 로그인 직후의 새 비밀번호 화면(setNewPassword)과 관리자의 임시 비밀번호(adminResetPassword).
// 비밀번호 원문은 해시에만 쓰고 저장·기록하지 않는다.
import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { newAuthId } from "@/lib/auth-id";
import { makeTempPassword } from "@/lib/password-reset";

/** 임시 비밀번호 (node:crypto randomInt로 고른 12자) */
export const newTempPassword = () => makeTempPassword((max) => randomInt(max));

/**
 * 회원의 아이디 로그인 비밀번호를 바꾸고 로그인(세션)을 끊는다. 한 트랜잭션.
 * - 해시는 라이브러리 설정 그대로 `(await auth.$context).password.hash` (로그인 확인과 같은 방식). 느리므로 트랜잭션 밖에서 먼저 계산한다
 * - 아이디 로그인 행(provider_id = credential)이 있으면 비밀번호만 고치고, 없으면(소셜만 있는 회원 — 가입이 늘 만들어 생기지 않지만)
 *   가입(src/server/signup.ts)과 같은 형식으로 만든다 (account_id = 회원 ID).
 *   라이브러리 internalAdapter.updatePassword는 account_id = 회원 ID인 행만 고치고 없으면 아무것도 안 하며,
 *   linkAccount와 세션 지우기를 한 트랜잭션으로 묶을 수 없어 여기서 직접 쓴다
 * - keepSessionId가 있으면 그 세션(지금 이 브라우저)만 남기고 나머지를 지운다. 없으면 모두 지운다
 */
export async function setMemberPassword(userId: string, password: string, opts: { keepSessionId?: string } = {}): Promise<void> {
  const hash = await (await auth.$context).password.hash(password);
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(accounts)
      .set({ password: hash, updatedAt: new Date() })
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
      .returning({ id: accounts.id });
    if (!updated.length) {
      await tx.insert(accounts).values({ id: newAuthId(), userId, providerId: "credential", accountId: userId, password: hash });
    }
    await tx
      .delete(sessions)
      .where(opts.keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, opts.keepSessionId)) : eq(sessions.userId, userId));
  });
}

/** 세션을 만든 시각 (DB에서 다시 읽는다. 없으면 null) */
export async function sessionCreatedAt(sessionId: string): Promise<Date | null> {
  const [row] = await db.select({ createdAt: sessions.createdAt }).from(sessions).where(eq(sessions.id, sessionId));
  return row?.createdAt ?? null;
}
