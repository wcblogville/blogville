// 알림 (GAME-06·GAME-08): 헤더 🔔·레벨업 팝업·알림함 조회와, 다른 영역이 부르는 활동 알림 기록
// 모든 조회·변경은 user_id = 지금 로그인한 회원 조건을 붙인다 (US6-4)
import "server-only";
import { and, desc, eq, gte, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, items, notifications, posts, profiles } from "@/db/schema";
import type { NotificationRow } from "@/lib/notifications";
import type { Tx } from "@/server/points";

/** 헤더용 한 쿼리: 안 읽은 수(10에서 멈춤), 안 읽은 레벨업의 가장 높은·낮은 레벨 */
export async function getHeaderNotifications(userId: string) {
  const [row] = await db
    .select({
      unread: sql<number>`LEAST(COUNT(*), 10)::int`,
      pendingLevel: sql<number | null>`MAX(${notifications.level})`,
      pendingMinLevel: sql<number | null>`MIN(${notifications.level})`,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row;
}

export const LEVEL_UP_ITEMS_SHOWN = 3;

/**
 * 팝업에 보여 줄 레벨업: 안 읽은 레벨업 중 가장 높은 레벨 하나와,
 * 안 읽은 범위(가장 낮은 ~ 가장 높은 레벨)에 새로 살 수 있게 된 판매 아이템 (캐릭터·기본 아이템 제외, FR-039)
 */
export async function getPendingLevelUp(userId: string, range?: { min: number; max: number }) {
  let min = range?.min;
  let max = range?.max;
  if (min === undefined || max === undefined) {
    const header = await getHeaderNotifications(userId);
    if (header.pendingLevel === null || header.pendingMinLevel === null) return null;
    min = header.pendingMinLevel;
    max = header.pendingLevel;
  }
  const where = and(ne(items.type, "character"), eq(items.isOnSale, true), gte(items.requiredLevel, min), lte(items.requiredLevel, max));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ id: items.id, name: items.name, assetKey: items.assetKey, type: items.type })
      .from(items)
      .where(where)
      .orderBy(desc(items.requiredLevel), items.id)
      .limit(LEVEL_UP_ITEMS_SHOWN),
    db.select({ total: sql<number>`COUNT(*)::int` }).from(items).where(where),
  ]);
  return { level: max, items: rows, moreCount: Math.max(0, total - rows.length) };
}

export const NOTIFICATIONS_PAGE_SIZE = 20;

/** 알림함 최신순 20개씩. 닉네임·글 제목·블로그 주소는 저장하지 않고 JOIN으로 읽는다 */
export async function listNotifications(userId: string, page: number) {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(eq(notifications.userId, userId));
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      level: notifications.level,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      actorNickname: profiles.nickname,
      postId: notifications.postId,
      postTitle: posts.title,
      blogSlug: blogs.slug,
    })
    .from(notifications)
    .leftJoin(profiles, eq(profiles.userId, notifications.actorId))
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .leftJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(NOTIFICATIONS_PAGE_SIZE)
    .offset((page - 1) * NOTIFICATIONS_PAGE_SIZE);
  return {
    rows: rows satisfies (NotificationRow & { id: number; createdAt: Date; readAt: Date | null })[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE)),
  };
}

/** 알림 하나와 이동할 곳을 만들 값 (본인 것만) */
export async function getOwnNotification(userId: string, id: number) {
  const [row] = await db
    .select({ kind: notifications.kind, postId: notifications.postId, blogSlug: blogs.slug })
    .from(notifications)
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .leftJoin(blogs, eq(blogs.id, posts.blogId))
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return row ?? null;
}

export type ActivityKind = "like" | "comment" | "reply";

/**
 * 공감·댓글·답글 알림 (GAME-08 2단계, social이 부른다). 그 활동과 같은 트랜잭션 안에서 부른다.
 * 자기 활동이면 아무것도 넣지 않는다 (FR-045, DB CHECK로도 막힘). 넣었으면 true.
 */
export async function notifyActivity(
  tx: Tx,
  input: { recipientId: string | null; actorId: string; kind: ActivityKind; postId: number },
): Promise<boolean> {
  if (!input.recipientId || input.recipientId === input.actorId) return false;
  if (!["like", "comment", "reply"].includes(input.kind)) return false;
  await tx.insert(notifications).values({ userId: input.recipientId, kind: input.kind, actorId: input.actorId, postId: input.postId });
  return true;
}
