// 내 정보의 로그인 수단 (AUTH-05 / FR-036~FR-041, contracts/account.md 1장)과 회원 탈퇴 (AUTH-06 / FR-050~FR-052, contracts/account.md 4장)
import "server-only";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { accounts, loginAttempts, users } from "@/db/schema";
import { enabledProviders } from "@/lib/auth";
import { SOCIAL_LABEL, SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/social";
import { lockUser } from "@/server/points";
import { prepareCommentsForWithdrawal } from "@/server/social";

export type SocialLogin = {
  provider: SocialProvider;
  label: string;
  /** 키가 준비된 서비스인지 (없으면 [연동하기] 비활성, FR-031) */
  ready: boolean;
  /** 연동한 날짜 (accounts.created_at). 연동하지 않았으면 null */
  linkedAt: Date | null;
};

/** 회원의 소셜 로그인 수단: 카카오·네이버·Google 순서로 서비스마다 연동 여부와 연동한 날짜 (FR-036) */
export async function getSocialLogins(userId: string): Promise<SocialLogin[]> {
  const rows = await db
    .select({ providerId: accounts.providerId, createdAt: accounts.createdAt })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), ne(accounts.providerId, "credential")));
  return SOCIAL_PROVIDERS.map((provider) => ({
    provider,
    label: SOCIAL_LABEL[provider],
    ready: enabledProviders[provider],
    // UNIQUE (user_id, provider_id)라 서비스마다 많아야 1행 (FR-039)
    linkedAt: rows.find((r) => r.providerId === provider)?.createdAt ?? null,
  }));
}

/** 그 서비스를 이미 연동했는지 */
export async function hasSocialLogin(userId: string, provider: SocialProvider): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, provider)))
    .limit(1);
  return !!row;
}

/**
 * 탈퇴 전 비밀번호 다시 확인 (FR-050). 아이디 로그인(credential) 행의 해시와 비교한다.
 * 비밀번호 원문은 비교에만 쓰고 저장·기록하지 않는다 (FR-012).
 */
export async function verifyMemberPassword(userId: string, password: string): Promise<boolean> {
  const [row] = await db
    .select({ hash: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  if (!row?.hash) return false;
  return verifyPassword({ hash: row.hash, password });
}

/**
 * 회원 탈퇴 트랜잭션 (FR-051, data-model.md 3장, research R11). 하나라도 실패하면 전부 롤백된다.
 * 1) lockUser — 같은 회원의 보상·구매와 겹치지 않게
 * 2) 탈퇴용 댓글 정리 (social의 prepareCommentsForWithdrawal: 남의 답글이 달린 댓글은 `삭제된 댓글이에요` 자리로 남고 답글도 그대로, FR-052)
 * 3) login_attempts의 그 아이디 행 삭제 (FK가 없어 CASCADE로 안 지워진다)
 * 4) users 행 삭제 → FK CASCADE로 세션·로그인 수단(연동한 소셜 포함)·프로필·블로그(→ 카테고리·글 → 글의 댓글·공감·태그 연결·방문 기록)·
 *    보유 아이템·이웃(양쪽)·공감·출석·원장·동물(→ 돌보기)·첨부 행.
 *    TODO(005-game): `notifications`는 game 6단계가 받는 회원·행동한 회원 FK를 `ON DELETE CASCADE`로 만든다 (game FR-046).
 *    TODO(006-shop): shop이 만들 새 표도 회원 FK를 CASCADE로 둔다. CASCADE가 아니면 이 DELETE가 FK에 막혀 탈퇴 전체가 취소된다.
 * 저장소 파일(UPLOAD_DIR)은 지우지 않는다. 행이 없는 파일은 post의 정리 작업이 지운다 (research R11 "저장소 파일").
 */
export async function deleteMember(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockUser(tx, userId);
    await prepareCommentsForWithdrawal(tx, userId);
    // 실패 기록은 아이디(users.username, 소문자 정규화)로 쌓인다
    await tx
      .delete(loginAttempts)
      .where(eq(loginAttempts.username, tx.select({ username: users.username }).from(users).where(eq(users.id, userId))));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
