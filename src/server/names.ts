// 아이디·블로그 주소·닉네임이 서로 겹치지 않게 하는 서버 검사 (AUTH-01 / FR-003, FR-009, FR-010, research R3)
// 세 값은 서로 다른 표의 칸이라 UNIQUE 하나로 막을 수 없다. 그래서 같은 이름에 대한 가입·변경이
// 이름 단위 잠금(lockName)을 잡고 줄을 선 뒤 findNameConflict로 확인하고 insert/update 한다.
// blog의 주소·닉네임 변경도 같은 순서(잠금 → 검사 → update)로 쓴다.
import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "@/server/points";

/**
 * 이름 잠금 번호. 두 정수 키 형식 pg_advisory_xact_lock(int, int)은
 * lockUser(src/server/points.ts)의 한 정수 키 형식과 키 공간이 겹치지 않는다 (PostgreSQL 문서).
 */
const NAME_LOCK_KEY = 0x4e414d45; // "NAME"

/** 이 트랜잭션이 끝날 때까지 같은 이름(대소문자 무시)에 대한 다른 가입·변경을 기다리게 한다 */
export async function lockName(tx: Tx, name: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${NAME_LOCK_KEY}, hashtext(lower(${name})))`);
}

export type NameConflict = { username: boolean; slug: boolean; nickname: boolean };

/**
 * 다른 회원의 아이디·블로그 주소·닉네임 가운데 name과 (대소문자 무시로) 같은 것이 있는지.
 * exceptUserId: 자기 자신의 값은 겹침으로 보지 않는다 (blog의 주소·닉네임 변경용).
 * 반드시 lockName을 건 트랜잭션 안에서 부른다.
 */
export async function findNameConflict(tx: Tx, name: string, opts: { exceptUserId?: string } = {}): Promise<NameConflict> {
  const except = opts.exceptUserId ?? null;
  // 아이디·주소는 소문자만 저장되므로(CHECK) 그대로 비교해 UNIQUE 인덱스를 쓴다. 닉네임만 lower()
  const result = await tx.execute<{ username: boolean; slug: boolean; nickname: boolean }>(sql`
    SELECT
      EXISTS (SELECT 1 FROM users WHERE username = lower(${name}) AND (${except}::text IS NULL OR id <> ${except})) AS username,
      EXISTS (SELECT 1 FROM blogs WHERE slug = lower(${name}) AND (${except}::text IS NULL OR owner_id <> ${except})) AS slug,
      EXISTS (SELECT 1 FROM profiles WHERE lower(nickname) = lower(${name}) AND (${except}::text IS NULL OR user_id <> ${except})) AS nickname
  `);
  const row = result.rows[0];
  return { username: Boolean(row?.username), slug: Boolean(row?.slug), nickname: Boolean(row?.nickname) };
}

export function hasNameConflict(c: NameConflict): boolean {
  return c.username || c.slug || c.nickname;
}
