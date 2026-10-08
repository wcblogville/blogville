// 교류: 댓글 수, 댓글 영역 데이터, 탈퇴 때 댓글 정리 (SOC-01, SOC-02 / contracts/comments.md 3·4절)
import "server-only";
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { blogs, comments, items, posts, profiles, replies } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { canDeleteComment } from "@/lib/social";
import type { Tx } from "@/server/points";

const characterItem = alias(items, "character_item");

/** 그 글의 삭제 안 된 댓글 수 + 삭제 안 된 답글 수 (FR-016, 카드 `💬 N`) */
export function liveCommentCountSql(postId: AnyPgColumn | SQL): SQL<number> {
  return sql<number>`(
    (SELECT COUNT(*) FROM ${comments} WHERE ${comments.postId} = ${postId} AND ${comments.deletedAt} IS NULL)
    + (SELECT COUNT(*) FROM ${replies} JOIN ${comments} ON ${comments.id} = ${replies.commentId}
       WHERE ${comments.postId} = ${postId} AND ${replies.deletedAt} IS NULL)
  )::int`;
}

/** 마을 전체 삭제 안 된 댓글 + 답글 수 (관리자 통계) */
export async function countLiveComments(): Promise<number> {
  const { rows } = await db.execute<{ n: number }>(sql`SELECT (
    (SELECT COUNT(*) FROM ${comments} WHERE ${comments.deletedAt} IS NULL)
    + (SELECT COUNT(*) FROM ${replies} WHERE ${replies.deletedAt} IS NULL)
  )::int AS n`);
  return rows[0].n;
}

export type CommentAuthor = { nickname: string; characterAsset: string; blogSlug: string };

export type ReplyView = {
  id: number;
  createdAtText: string;
  deleted: boolean;
  content: string;
  author: CommentAuthor;
  canDelete: boolean;
};

export type CommentView = {
  id: number;
  createdAtText: string;
  deleted: boolean;
  content: string;
  /** null = 탈퇴 자리 */
  author: CommentAuthor | null;
  canReply: boolean;
  canDelete: boolean;
  replies: ReplyView[];
};

export type CommentThread = { count: number; comments: CommentView[] };

const authorColumns = {
  nickname: profiles.nickname,
  characterAsset: characterItem.assetKey,
  blogSlug: blogs.slug,
};

/**
 * 글 상세의 댓글 영역. 댓글·답글 모두 오래된 순, 권한(canReply·canDelete)은 서버가 계산한다.
 * 화면으로 넘기는 데이터에 작성자 회원 ID와 삭제된 내용을 넣지 않는다 (SC-006, research R13)
 */
export async function getCommentThread(
  postId: number,
  viewer: { userId: string; isAdmin: boolean } | null,
): Promise<CommentThread> {
  const [owner] = await db
    .select({ ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(posts.id, postId));
  if (!owner) return { count: 0, comments: [] };

  const commentRows = await db
    .select({ id: comments.id, authorId: comments.authorId, content: comments.content, createdAt: comments.createdAt, deletedAt: comments.deletedAt, ...authorColumns })
    .from(comments)
    .leftJoin(profiles, eq(profiles.userId, comments.authorId))
    .leftJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
    .leftJoin(blogs, eq(blogs.ownerId, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id));

  const replyRows = commentRows.length
    ? await db
        .select({ id: replies.id, commentId: replies.commentId, authorId: replies.authorId, content: replies.content, createdAt: replies.createdAt, deletedAt: replies.deletedAt, ...authorColumns })
        .from(replies)
        .innerJoin(profiles, eq(profiles.userId, replies.authorId))
        .innerJoin(characterItem, eq(characterItem.id, profiles.characterItemId))
        .innerJoin(blogs, eq(blogs.ownerId, replies.authorId))
        .where(inArray(replies.commentId, commentRows.map((c) => c.id)))
        .orderBy(asc(replies.createdAt), asc(replies.id))
    : [];

  const can = (authorId: string | null) =>
    canDeleteComment({ viewerId: viewer?.userId ?? null, isAdmin: viewer?.isAdmin ?? false, authorId, blogOwnerId: owner.ownerId });
  let count = 0;

  const views = commentRows.map((c): CommentView => {
    const deleted = c.deletedAt !== null;
    if (!deleted) count++;
    const author = c.authorId && c.nickname && c.characterAsset && c.blogSlug
      ? { nickname: c.nickname, characterAsset: c.characterAsset, blogSlug: c.blogSlug }
      : null;
    return {
      id: c.id,
      createdAtText: formatDateTime(c.createdAt),
      deleted,
      content: deleted ? "" : c.content,
      author,
      canReply: viewer !== null && !deleted,
      canDelete: !deleted && can(c.authorId),
      replies: replyRows
        .filter((r) => r.commentId === c.id)
        .map((r) => {
          const rDeleted = r.deletedAt !== null;
          if (!rDeleted) count++;
          return {
            id: r.id,
            createdAtText: formatDateTime(r.createdAt),
            deleted: rDeleted,
            content: rDeleted ? "" : r.content,
            author: { nickname: r.nickname, characterAsset: r.characterAsset, blogSlug: r.blogSlug },
            canDelete: !rDeleted && can(r.authorId),
          };
        }),
    };
  });
  return { count, comments: views };
}

/**
 * 탈퇴 트랜잭션에서 회원 행을 지우기 전에 부른다 (D2, data-model 7, auth FR-052).
 * 1) 그 회원 댓글 잠금 2) 다른 회원 답글(삭제 표시 포함)이 없는 댓글은 행 삭제
 * 3) 남은 댓글은 삭제 자리로 (내용 비움). 이후 회원을 지우면 답글은 CASCADE, 남은 댓글 author_id는 SET NULL
 */
export async function prepareCommentsForWithdrawal(tx: Tx, userId: string): Promise<void> {
  await tx.select({ id: comments.id }).from(comments).where(eq(comments.authorId, userId)).for("update");
  const othersReply = sql`EXISTS (SELECT 1 FROM ${replies} WHERE ${replies.commentId} = ${comments.id} AND ${replies.authorId} <> ${userId})`;
  await tx.delete(comments).where(and(eq(comments.authorId, userId), sql`NOT ${othersReply}`));
  await tx
    .update(comments)
    .set({ deletedAt: sql`COALESCE(${comments.deletedAt}, now())`, content: "" })
    .where(eq(comments.authorId, userId));
}
