// 아이디별 로그인 실패 기록 (AUTH-09 / FR-025~FR-028, data-model 2.4, research R8)
// 순서: reserveLoginAttempt(짧은 트랜잭션, 비밀번호 확인 전) → 트랜잭션 밖에서 라이브러리 로그인 → 성공이면 clearLoginAttempts.
// 예약 트랜잭션 안에서는 라이브러리나 다른 DB 연결을 쓰지 않는다. 쓰면 동시 로그인 요청이 연결 풀을 모두 잡고
// 두 번째 연결을 서로 기다리며 서버의 DB 접근이 멈춘다 (research R8 "라이브러리 호출을 트랜잭션 밖에 두는 이유").
import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";
import { reserveAttempt, type LoginAttemptState } from "@/lib/login-limit";
import type { Tx } from "@/server/points";

/**
 * 로그인 잠금 번호. 두 정수 키 형식 pg_advisory_xact_lock(int, int)이라 lockUser(한 정수 키)와 겹치지 않고,
 * 첫 키가 이름 잠금(NAME_LOCK_KEY, src/server/names.ts)과 달라 가입·이름 변경과도 줄을 서지 않는다.
 */
const LOGIN_LOCK_KEY = 0x4c4f4749; // "LOGI"

/**
 * 이번 로그인 시도를 실패로 미리 센다. 잠금 중이면 행을 바꾸지 않고 false (비밀번호를 확인하지 말 것).
 * 같은 아이디의 예약은 advisory lock으로 한 줄로 서므로, 잠금 창마다 비밀번호 확인은 최대 5번이다 (SC-006).
 * 시각은 DB의 now()를 쓴다 (서버가 여러 대여도 같은 시계).
 * username: 정규화(normalizeName)한 1~64자 입력. 없는 아이디도 같은 행을 만든다 (FR-027).
 */
export async function reserveLoginAttempt(username: string): Promise<boolean> {
  return db.transaction(async (tx: Tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOGIN_LOCK_KEY}, hashtext(${username}))`);
    const result = await tx.execute<{ failed_count: number | null; locked_until: Date | string | null; now: Date | string }>(sql`
      SELECT a.failed_count, a.locked_until, now() AS now
      FROM (SELECT 1) AS one
      LEFT JOIN ${loginAttempts} AS a ON a.username = ${username}
    `);
    const row = result.rows[0];
    const now = new Date(row.now);
    const state: LoginAttemptState | null =
      row.failed_count === null ? null : { failedCount: row.failed_count, lockedUntil: row.locked_until === null ? null : new Date(row.locked_until) };

    const reserved = reserveAttempt(state, now);
    if (!reserved.allowed) return false;

    const values = { failedCount: reserved.next.failedCount, lockedUntil: reserved.next.lockedUntil, updatedAt: now };
    await tx
      .insert(loginAttempts)
      .values({ username, ...values })
      .onConflictDoUpdate({ target: loginAttempts.username, set: values });
    return true;
  });
}

/** 로그인 성공: 그 아이디의 기록(미리 센 실패와 방금 건 잠금 포함)을 지운다 (FR-026) */
export async function clearLoginAttempts(username: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
}
