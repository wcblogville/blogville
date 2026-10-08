"use server";

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { blogs, blogVisits, comments, follows, pointLedger, postLikes, posts, replies } from "@/db/schema";
import { parseId } from "@/lib/ids";
import { checkComment, SOCIAL_ERRORS } from "@/lib/social";
import { todayKST } from "@/lib/game";
import { getBlogVisitStats } from "@/server/blog";
import { getViewer, requireMember, type Viewer } from "@/server/dal";
import { foreignKeyViolation } from "@/server/db-errors";
import { grantReward, lockUser, type Tx } from "@/server/points";
import { ensureVisitorId } from "@/server/visitor";

/**
 * 볼 수 있는 글(공개 글이거나 내 글)과 그 블로그 주인. 트랜잭션 안에서 글 행을 FOR KEY SHARE로 잠가
 * 확인과 저장 사이에 글이 지워지지 않게 한다 (research R6). 비공개 전환은 막지 않는다
 */
async function lockVisiblePost(tx: Tx, postId: number, viewerId: string) {
  const [row] = await tx
    .select({ id: posts.id, visibility: posts.visibility, ownerId: blogs.ownerId })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(posts.id, postId))
    .for("key share", { of: posts });
  if (!row) return null;
  if (row.visibility === "private" && row.ownerId !== viewerId) return null;
  return row;
}

const isAdmin = (viewer: Viewer) => viewer.user.role === "admin";

// ===== 공감 (SOC-03) =====
export async function toggleLike(postId: unknown) {
  const viewer = await requireMember();
  const id = parseId(postId);
  if (id === null) return;

  const changed = await db.transaction(async (tx) => {
    const post = await lockVisiblePost(tx, id, viewer.userId);
    if (!post) return false;
    const removed = await tx
      .delete(postLikes)
      .where(and(eq(postLikes.postId, id), eq(postLikes.userId, viewer.userId)))
      .returning({ postId: postLikes.postId });
    if (removed.length) return true; // 공감 취소 (보상은 돌려받지 않는다)

    // 두 탭에서 동시에 눌러도 1행만 (빈 배열이면 다른 요청이 먼저 넣었다)
    const inserted = await tx.insert(postLikes).values({ postId: id, userId: viewer.userId }).onConflictDoNothing().returning({ postId: postLikes.postId });
    if (!inserted.length || post.ownerId === viewer.userId) return true;

    // 글 주인에게 보상. 이 사람에게서 이 글로 받은 적이 없을 때만 (취소 후 재공감 방지, FR-029)
    await lockUser(tx, post.ownerId);
    const refId = `${id}:${viewer.userId}`;
    const [already] = await tx
      .select({ id: pointLedger.id })
      .from(pointLedger)
      .where(and(eq(pointLedger.userId, post.ownerId), eq(pointLedger.reason, "like_received"), eq(pointLedger.refId, refId)));
    if (!already) await grantReward(tx, post.ownerId, "like_received", refId);
    return true;
  });
  if (changed) revalidatePath("/", "layout");
}

// ===== 댓글·답글 (SOC-01, SOC-02) =====
/** content: 실패하면 받은 그대로 돌려주어 입력칸에 남긴다 (research R7) */
export type CommentState = { ok?: number; error?: string; content?: string };

class Refused extends Error {}

export async function addComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const viewer = await requireMember();
  const raw = formData.get("content");
  const content = typeof raw === "string" ? raw : "";
  const postId = parseId(formData.get("postId"));
  if (postId === null) return { error: SOCIAL_ERRORS.badRequest, content };
  const checked = checkComment(raw);
  if (!checked.ok) return { error: checked.error, content };

  try {
    await db.transaction(async (tx) => {
      const post = await lockVisiblePost(tx, postId, viewer.userId);
      if (!post) throw new Refused(SOCIAL_ERRORS.postNotFound);
      const [created] = await tx
        .insert(comments)
        .values({ postId, authorId: viewer.userId, content: checked.content })
        .returning({ id: comments.id });
      // 남의 글이면 ✨ 5 · 🪙 5 (답글과 합쳐 하루 10번, 넘으면 저장만, FR-010)
      if (post.ownerId !== viewer.userId) {
        await lockUser(tx, viewer.userId);
        await grantReward(tx, viewer.userId, "comment", created.id);
      }
    });
  } catch (err) {
    if (err instanceof Refused) return { error: err.message, content };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

export async function addReply(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const viewer = await requireMember();
  const raw = formData.get("content");
  const content = typeof raw === "string" ? raw : "";
  const postId = parseId(formData.get("postId"));
  const commentId = parseId(formData.get("commentId"));
  if (postId === null || commentId === null) return { error: SOCIAL_ERRORS.badRequest, content };
  const checked = checkComment(raw);
  if (!checked.ok) return { error: checked.error, content };

  try {
    await db.transaction(async (tx) => {
      const post = await lockVisiblePost(tx, postId, viewer.userId);
      if (!post) throw new Refused(SOCIAL_ERRORS.postNotFound);
      // 원댓글을 FOR SHARE로 잠가 삭제와 겹치지 않게 한다 (research R5)
      const [parent] = await tx
        .select({ postId: comments.postId, deletedAt: comments.deletedAt })
        .from(comments)
        .where(eq(comments.id, commentId))
        .for("share");
      if (!parent || parent.postId !== postId) throw new Refused(SOCIAL_ERRORS.noComment);
      if (parent.deletedAt) throw new Refused(SOCIAL_ERRORS.deletedComment);
      const [created] = await tx
        .insert(replies)
        .values({ commentId, authorId: viewer.userId, content: checked.content })
        .returning({ id: replies.id });
      // 사유가 댓글과 같아 하루 10번은 댓글과 합쳐 센다 (FR-023)
      if (post.ownerId !== viewer.userId) {
        await lockUser(tx, viewer.userId);
        await grantReward(tx, viewer.userId, "comment", `reply:${created.id}`);
      }
    });
  } catch (err) {
    if (err instanceof Refused) return { error: err.message, content };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

/** 작성자·그 글의 블로그 주인·관리자만. 그 밖은 아무 일도 없다. 답글·보상은 그대로 (FR-013~015) */
export async function deleteComment(commentId: unknown) {
  const viewer = await requireMember();
  const id = parseId(commentId);
  if (id === null) return;
  const rows = await db
    .update(comments)
    .set({ deletedAt: sql`now()`, content: "" })
    .where(
      and(
        eq(comments.id, id),
        isNull(comments.deletedAt),
        isAdmin(viewer)
          ? undefined
          : or(
              eq(comments.authorId, viewer.userId),
              sql`EXISTS (SELECT 1 FROM ${posts} JOIN ${blogs} ON ${blogs.id} = ${posts.blogId}
                WHERE ${posts.id} = ${comments.postId} AND ${blogs.ownerId} = ${viewer.userId})`,
            ),
      ),
    )
    .returning({ id: comments.id });
  if (rows.length) revalidatePath("/", "layout");
}

export async function deleteReply(replyId: unknown) {
  const viewer = await requireMember();
  const id = parseId(replyId);
  if (id === null) return;
  const rows = await db
    .update(replies)
    .set({ deletedAt: sql`now()`, content: "" })
    .where(
      and(
        eq(replies.id, id),
        isNull(replies.deletedAt),
        isAdmin(viewer)
          ? undefined
          : or(
              eq(replies.authorId, viewer.userId),
              sql`EXISTS (SELECT 1 FROM ${comments} JOIN ${posts} ON ${posts.id} = ${comments.postId}
                JOIN ${blogs} ON ${blogs.id} = ${posts.blogId}
                WHERE ${comments.id} = ${replies.commentId} AND ${blogs.ownerId} = ${viewer.userId})`,
            ),
      ),
    )
    .returning({ id: replies.id });
  if (rows.length) revalidatePath("/", "layout");
}

// ===== 이웃 (SOC-04) =====
export async function toggleFollow(followeeId: unknown) {
  const viewer = await requireMember();
  if (typeof followeeId !== "string" || followeeId.length < 1 || followeeId.length > 64) return;
  if (followeeId === viewer.userId) return;

  const removed = await db
    .delete(follows)
    .where(and(eq(follows.followerId, viewer.userId), eq(follows.followeeId, followeeId)))
    .returning({ id: follows.followeeId });
  if (!removed.length) {
    // 블로그가 있는 회원만 (없는 회원 ID로 조작한 요청은 0행). 동시 요청이면 1행만 (FR-039, FR-040)
    try {
      await db.execute(sql`INSERT INTO ${follows} (follower_id, followee_id)
        SELECT ${viewer.userId}, ${blogs.ownerId} FROM ${blogs} WHERE ${blogs.ownerId} = ${followeeId}
        ON CONFLICT DO NOTHING`);
    } catch (err) {
      // 그 순간 대상 회원이 지워졌으면 무시 (research R10)
      if (!foreignKeyViolation(err)) throw err;
    }
  }
  revalidatePath("/", "layout");
}

// ===== 블로그 방문자 (BLOG-06) =====
/**
 * 블로그 홈이 브라우저에 열리면 부른다. 같은 사람(쿠키)은 하루 1번만 센다.
 * 방문자도 불러야 해서 requireMember()가 없다 (signUp·signIn처럼). 블로그 주인은 서버에서 다시 확인해 세지 않는다.
 * 쿠키를 새로 만들 수 있어야 해서 서버 컴포넌트가 아니라 Server Action에서 센다 (Next.js 16 cookies 규칙)
 */
export async function recordBlogVisit(blogId: number): Promise<{ today: number; yesterday: number; total: number } | null> {
  const id = parseId(blogId);
  if (id === null) return null;
  const [blog] = await db.select({ ownerId: blogs.ownerId }).from(blogs).where(eq(blogs.id, id));
  if (!blog) return null;

  const viewer = await getViewer();
  if (viewer?.profile && viewer.userId === blog.ownerId) return getBlogVisitStats(id);

  const visitorId = await ensureVisitorId();
  await db.insert(blogVisits).values({ blogId: id, date: todayKST(), visitorId }).onConflictDoNothing();
  return getBlogVisitStats(id);
}
