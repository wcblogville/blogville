"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { blogs, comments, follows, pointLedger, postLikes, posts } from "@/db/schema";
import { MAX_DB_INT, parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { grantReward, lockUser } from "@/server/points";

/** 글과 그 글의 블로그 주인 (공개 글이거나 내 글일 때만) */
async function findVisiblePost(postId: number, viewerId: string) {
  const [row] = await db
    .select({ id: posts.id, visibility: posts.visibility, ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(posts.id, postId));
  if (!row) return null;
  if (row.visibility === "private" && row.ownerId !== viewerId) return null;
  return row;
}

// ===== 공감 =====
export async function toggleLike(postId: number) {
  const viewer = await requireMember();
  if (parseId(postId) === null) return;
  const post = await findVisiblePost(postId, viewer.userId);
  if (!post) return;

  await db.transaction(async (tx) => {
    const removed = await tx
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, viewer.userId)))
      .returning({ postId: postLikes.postId });
    if (removed.length) return; // 공감 취소

    await tx.insert(postLikes).values({ postId, userId: viewer.userId });

    // 글 주인에게 보상. 내 글이 아니고, 이 사람에게서 이 글로 받은 적이 없을 때만 (취소 후 재공감 방지)
    if (post.ownerId === viewer.userId) return;
    await lockUser(tx, post.ownerId);
    const refId = `${postId}:${viewer.userId}`;
    const [already] = await tx
      .select({ id: pointLedger.id })
      .from(pointLedger)
      .where(and(eq(pointLedger.userId, post.ownerId), eq(pointLedger.reason, "like_received"), eq(pointLedger.refId, refId)));
    if (!already) await grantReward(tx, post.ownerId, "like_received", refId);
  });
  revalidatePath("/", "layout");
}

// ===== 댓글 =====
const commentSchema = z.object({
  postId: z.coerce.number().int().positive().max(MAX_DB_INT, "잘못된 요청이에요"),
  parentId: z.coerce.number().int().positive().max(MAX_DB_INT, "잘못된 요청이에요").optional(),
  content: z.string().trim().min(1, "댓글을 적어 주세요").max(1000, "댓글은 1000자까지예요"),
});

export type CommentState = { error?: string; ok?: number };

export async function addComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const viewer = await requireMember();
  const parsed = commentSchema.safeParse({
    postId: formData.get("postId"),
    parentId: formData.get("parentId") || undefined,
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { postId, parentId, content } = parsed.data;

  const post = await findVisiblePost(postId, viewer.userId);
  if (!post) return { error: "글을 찾을 수 없어요" };

  await db.transaction(async (tx) => {
    // 답글은 같은 글의 원댓글에만 (답글의 답글은 원댓글에 붙인다)
    let parent: number | null = null;
    if (parentId) {
      const [p] = await tx
        .select({ id: comments.id, parentId: comments.parentId })
        .from(comments)
        .where(and(eq(comments.id, parentId), eq(comments.postId, postId)));
      parent = p ? (p.parentId ?? p.id) : null;
    }
    const [created] = await tx
      .insert(comments)
      .values({ postId, authorId: viewer.userId, parentId: parent, content })
      .returning({ id: comments.id });

    if (post.ownerId !== viewer.userId) {
      await lockUser(tx, viewer.userId);
      await grantReward(tx, viewer.userId, "comment", created.id);
    }
  });
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

export async function deleteComment(commentId: number) {
  const viewer = await requireMember();
  if (parseId(commentId) === null) return;
  // 내 댓글만. 답글이 남아 있을 수 있어서 행은 두고 삭제 표시만 한다
  await db
    .update(comments)
    .set({ deletedAt: new Date() })
    .where(and(eq(comments.id, commentId), eq(comments.authorId, viewer.userId), isNull(comments.deletedAt)));
  revalidatePath("/", "layout");
}

// ===== 이웃 =====
export async function toggleFollow(followeeId: string) {
  const viewer = await requireMember();
  if (followeeId === viewer.userId) return;

  const removed = await db
    .delete(follows)
    .where(and(eq(follows.followerId, viewer.userId), eq(follows.followeeId, followeeId)))
    .returning({ id: follows.followeeId });
  if (!removed.length) {
    await db.insert(follows).values({ followerId: viewer.userId, followeeId }).onConflictDoNothing();
  }
  revalidatePath("/", "layout");
}
