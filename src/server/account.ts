// 내 정보의 로그인 수단 (AUTH-05 / FR-036~FR-041, contracts/account.md 1장)과 회원 탈퇴 (AUTH-06 / FR-050~FR-052, contracts/account.md 4장)
import "server-only";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { accounts, comments, loginAttempts, users } from "@/db/schema";
import { enabledProviders } from "@/lib/auth";
import { SOCIAL_LABEL, SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/social";
import { lockUser, type Tx } from "@/server/points";

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
 * 탈퇴용 댓글 정리 (FR-052, research R11 2-2, data-model.md 3장 순서 2) — social이 만들 때까지의 임시 구현.
 *
 * TODO(004-social T046): social의 `prepareCommentsForWithdrawal(tx, userId)` (`src/server/social.ts`)로 바꾼다.
 * social 5단계가 `comments.author_id`를 NULL 허용 + `ON DELETE SET NULL`(+ CHECK)로 바꾸고 답글을 `replies` 표로 나누면
 * "남의 답글이 달린 내 댓글"은 내용·작성자 없는 `삭제된 댓글이에요` 자리로 남고 남의 답글도 그대로 남는다 (US7 #6).
 *
 * 지금 스키마(답글 = `comments.parent_id`, `author_id` NOT NULL + CASCADE)에서는 그 자리를 남길 수 없다.
 * 그래서 지금은 이 회원의 댓글·답글을 모두 지운다 (US7 #5는 맞다). 남의 답글이 달린 이 회원의 댓글은
 * `comments_parent_fk` CASCADE로 그 아래 남의 답글까지 함께 지워진다 — social 5단계 전까지의 알려진 차이다.
 * 자리를 지금 만들 수 없는 이유: 회원 행을 지우면 `author_id` CASCADE가 그 댓글 행을 지운다.
 */
async function removeAuthorComments(tx: Tx, userId: string): Promise<void> {
  // 답글이 먼저 지워져도 원댓글 삭제가 막히지 않도록 한 문장으로 지운다 (부모 FK CASCADE)
  await tx.delete(comments).where(eq(comments.authorId, userId));
}

/**
 * 회원 탈퇴 트랜잭션 (FR-051, data-model.md 3장, research R11). 하나라도 실패하면 전부 롤백된다.
 * 1) lockUser — 같은 회원의 보상·구매와 겹치지 않게
 * 2) 탈퇴용 댓글 정리 (위 removeAuthorComments, social 5단계에 교체)
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
    await removeAuthorComments(tx, userId);
    // 실패 기록은 아이디(users.username, 소문자 정규화)로 쌓인다
    await tx
      .delete(loginAttempts)
      .where(eq(loginAttempts.username, tx.select({ username: users.username }).from(users).where(eq(users.id, userId))));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
