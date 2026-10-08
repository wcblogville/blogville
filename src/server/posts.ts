// 글 저장·발행 안내·카테고리 선택·조회 기록 (POST-01~03, POST-06, POST-07, POST-09)
import "server-only";
import { and, asc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachments, categories, pointLedger, postViews, posts, profiles, subcategories } from "@/db/schema";
import { todayKST } from "@/lib/game";
import type { Tx } from "@/server/points";
import { attachmentKeysIn, type KnownAttachments } from "@/server/sanitize";

// ===== 첨부 붙이기 (FR-047, FR-054, data-model 3.3, research R6·R17) =====

/**
 * 본문의 /files/키 중 이 글에 붙일 수 있는 첨부만 정화의 known으로 돌려준다.
 * 행을 키 순서로 FOR UPDATE 잠가, 동시에 저장하는 다른 글이나 정리 작업과 엇갈리지 않게 한다.
 * 조건: ① 행 있음 ② 올린 사람 = 저장하는 회원 ③ 어느 글에도 안 붙음 또는 이 글(새 글은 안 붙음만)
 * ④ 프로필 사진 아님 ⑤ 종류(사진·파일 카드)는 정화가 확인한다
 */
export async function lockLinkableAttachments(tx: Tx, userId: string, postId: number | null, html: string): Promise<KnownAttachments> {
  const keys = attachmentKeysIn(html).sort();
  if (!keys.length) return new Map();
  const rows = await tx
    .select({ key: attachments.key, kind: attachments.kind, name: attachments.name, size: attachments.size })
    .from(attachments)
    .where(
      and(
        inArray(attachments.key, keys),
        eq(attachments.userId, userId),
        postId === null ? isNull(attachments.postId) : or(isNull(attachments.postId), eq(attachments.postId, postId)),
        sql`NOT EXISTS (SELECT 1 FROM ${profiles} WHERE ${profiles.photoKey} = ${attachments.key})`,
      ),
    )
    .orderBy(asc(attachments.key))
    .for("update", { of: attachments });
  return new Map(rows.map((a) => [a.key, { kind: a.kind as "image" | "file", name: a.name, size: a.size }]));
}

/** 저장한 본문에 남은 첨부는 이 글에, 이 글에 붙어 있다가 빠진 첨부는 떼어 낸다(트리거가 detached_at 기록) */
export async function syncPostAttachments(tx: Tx, postId: number, keys: string[]) {
  if (keys.length) {
    await tx.update(attachments).set({ postId }).where(and(inArray(attachments.key, keys), isNull(attachments.postId)));
  }
  await tx
    .update(attachments)
    .set({ postId: null })
    .where(and(eq(attachments.postId, postId), keys.length ? notInArray(attachments.key, keys) : undefined));
}

// ===== 발행 안내 (FR-013, research R13) =====

export type PublishNotice = "reward" | "noReward";

/** 주인 + 만든 지 10분 안이면 원장에 이 글의 글쓰기 보상이 있는지로 안내를 고른다. 그 밖은 null */
export async function getPublishNotice(viewerId: string | null, post: { id: number; ownerId: string; createdAt: Date }): Promise<PublishNotice | null> {
  if (!viewerId || viewerId !== post.ownerId) return null;
  if (Date.now() - post.createdAt.getTime() > 10 * 60 * 1000) return null;
  const [row] = await db
    .select({ id: pointLedger.id })
    .from(pointLedger)
    .where(and(eq(pointLedger.userId, post.ownerId), eq(pointLedger.reason, "post"), eq(pointLedger.refId, String(post.id))));
  return row ? "reward" : "noReward";
}

// ===== 대분류·소분류 (POST-03 / FR-030~032, research R15) =====

export type CategoryOption = { id: number; name: string; subcategories: { id: number; name: string }[] };

/** 글쓰기 선택지: 대분류를 블로그 관리 순서로, 각 대분류 아래 소분류 순서대로 */
export async function getCategoryOptions(blogId: number): Promise<CategoryOption[]> {
  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.blogId, blogId))
    .orderBy(asc(categories.position), asc(categories.id));
  if (!cats.length) return [];
  const subs = await db
    .select({ id: subcategories.id, categoryId: subcategories.categoryId, name: subcategories.name })
    .from(subcategories)
    .where(
      inArray(
        subcategories.categoryId,
        cats.map((c) => c.id),
      ),
    )
    .orderBy(asc(subcategories.position), asc(subcategories.id));
  return cats.map((c) => ({ ...c, subcategories: subs.filter((s) => s.categoryId === c.id).map(({ id, name }) => ({ id, name })) }));
}

/**
 * 저장할 대분류·소분류를 정한다 (FOR KEY SHARE로 읽어 저장 중 삭제와 엇갈리지 않게).
 * 남의·없는 대분류 → 둘 다 NULL(오류 없음), 소분류 행이 없으면 대분류만, 다른 대분류 소속 소분류 → "bad"
 */
export async function resolveCategory(
  tx: Tx,
  blogId: number,
  categoryId: number | null,
  subcategoryId: number | null,
): Promise<{ categoryId: number | null; subcategoryId: number | null } | "bad"> {
  if (categoryId === null) return subcategoryId === null ? { categoryId: null, subcategoryId: null } : "bad";
  const [cat] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.blogId, blogId)))
    .for("key share");
  if (!cat) return { categoryId: null, subcategoryId: null };
  if (subcategoryId === null) return { categoryId: cat.id, subcategoryId: null };
  const [sub] = await tx
    .select({ id: subcategories.id, categoryId: subcategories.categoryId })
    .from(subcategories)
    .where(eq(subcategories.id, subcategoryId))
    .for("key share");
  if (!sub) return { categoryId: cat.id, subcategoryId: null };
  if (sub.categoryId !== cat.id) return "bad";
  return { categoryId: cat.id, subcategoryId: sub.id };
}

// ===== 조회 기록 (POST-06 / FR-046, data-model 4) =====

/** 이 브라우저로 오늘 이 글을 센 적이 있나 (서버 렌더에서 처음 그릴 값을 정한다, research R2) */
export async function hasViewedToday(postId: number, visitorId: string | null) {
  if (!visitorId) return false;
  const [row] = await db
    .select({ x: postViews.postId })
    .from(postViews)
    .where(and(eq(postViews.postId, postId), eq(postViews.date, todayKST()), eq(postViews.visitorId, visitorId)));
  return Boolean(row);
}

/** 오늘 이 브라우저의 첫 조회면 기록하고 view_count + 1 (updated_at은 그대로). 현재 조회수를 돌려준다 */
export async function recordView(postId: number, visitorId: string) {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(postViews)
      .values({ postId, date: todayKST(), visitorId })
      .onConflictDoNothing()
      .returning({ postId: postViews.postId });
    if (inserted.length) {
      const [row] = await tx
        .update(posts)
        .set({ viewCount: sql`${posts.viewCount} + 1`, updatedAt: sql`${posts.updatedAt}` })
        .where(eq(posts.id, postId))
        .returning({ viewCount: posts.viewCount });
      return row?.viewCount ?? 0;
    }
    const [row] = await tx.select({ viewCount: posts.viewCount }).from(posts).where(eq(posts.id, postId));
    return row?.viewCount ?? 0;
  });
}
