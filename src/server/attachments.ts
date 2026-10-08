// 첨부 읽기 권한·붙여 넣기 다시 올리기·정리 작업 (POST-02 첨부 공개 범위, POST-07, POST-09).
// 정리 스크립트(scripts/cleanup-posts.ts)도 불러오므로 next/*, src/server/dal.ts, src/lib/auth.ts를 import하지 않는다 (contracts/attachments-http.md §3)
import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { attachments, blogs, postViews, posts, profiles } from "@/db/schema";
import { attachmentUrl, pasteAction, type PasteAction } from "@/lib/attachments";
import { previousDay, todayKST } from "@/lib/game";
import { copyAttachment, deleteAttachment, listStoredFiles } from "@/server/storage";

const isProfilePhoto = sql<boolean>`EXISTS (SELECT 1 FROM ${profiles} WHERE ${profiles.photoKey} = ${attachments.key})`;

/** 첨부 행 + 붙은 글의 공개 설정 + 그 블로그 주인 + 프로필 사진 여부 (GET /files/[key]) */
export async function findReadableAttachment(key: string) {
  const [row] = await db
    .select({
      kind: attachments.kind,
      name: attachments.name,
      mime: attachments.mime,
      size: attachments.size,
      uploaderId: attachments.userId,
      postVisibility: posts.visibility,
      postOwnerId: blogs.ownerId,
      isProfilePhoto,
    })
    .from(attachments)
    .leftJoin(posts, eq(posts.id, attachments.postId))
    .leftJoin(blogs, eq(blogs.id, posts.blogId))
    .where(eq(attachments.key, key));
  return row ?? null;
}

/** 붙여 넣은 키마다 keep / reupload / drop (FR-047, contracts/write-actions.md §4) */
export async function classifyPasted(keys: string[], viewerId: string, currentPostId: number | null) {
  const rows = keys.length
    ? await db
        .select({ key: attachments.key, uploaderId: attachments.userId, postId: attachments.postId, name: attachments.name, isProfilePhoto })
        .from(attachments)
        .where(inArray(attachments.key, keys))
    : [];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return keys.map((key) => {
    const row = byKey.get(key) ?? null;
    const action: PasteAction = pasteAction(row, viewerId, currentPostId);
    // 원래 이름은 내 첨부일 때만 알려 준다 (다시 올리기 실패 문구 `파일 이름: …`)
    return { key, action, name: action === "drop" ? "" : (row?.name ?? "") };
  });
}

/**
 * 다시 올리기 (research R8): 원본은 그대로 두고 새 키로 복사본 + 새 행(post_id NULL).
 * 서버에서 다시 판정해 reupload일 때만. 행을 넣지 못하면 복사본은 정리 작업의 "주인 없는 파일"이 지운다
 */
export async function reuploadAttachment(key: string, viewerId: string, currentPostId: number | null) {
  const [item] = await classifyPasted([key], viewerId, currentPostId);
  if (item.action !== "reupload") return null;
  const [row] = await db.select().from(attachments).where(eq(attachments.key, key));
  if (!row) return null;
  const newKey = randomBytes(16).toString("hex");
  await copyAttachment(key, newKey);
  await db.insert(attachments).values({ key: newKey, userId: viewerId, kind: row.kind, name: row.name, mime: row.mime, size: row.size });
  return { key: newKey, url: attachmentUrl(newKey), kind: row.kind as "image" | "file", name: row.name, size: row.size };
}

/**
 * 정리 작업 (FR-059, SC-011, contracts/attachments-http.md §3).
 * ① 하루 넘게 어느 글에도 붙지 않은 첨부(프로필 사진 제외) 행·파일 ② 행 없는 저장소 파일(1시간 넘은 것) ③ 어제보다 오래된 조회 기록
 */
export async function cleanupPostData({ dryRun }: { dryRun: boolean }) {
  // ① 저장 중인 글이 FOR UPDATE로 잡은 행은 기다리지 않고 건너뛴다 (SKIP LOCKED, research R6)
  const staleWhere = sql`${attachments.postId} IS NULL
    AND COALESCE(${attachments.detachedAt}, ${attachments.createdAt}) < now() - interval '1 day'
    AND NOT ${isProfilePhoto}`;
  let removedKeys: string[];
  if (dryRun) {
    removedKeys = (await db.select({ key: attachments.key }).from(attachments).where(staleWhere)).map((r) => r.key);
  } else {
    const result = await db.execute<{ key: string }>(sql`
      DELETE FROM ${attachments} WHERE ${attachments.key} IN (
        SELECT ${attachments.key} FROM ${attachments} WHERE ${staleWhere} FOR UPDATE SKIP LOCKED
      ) RETURNING ${attachments.key}`);
    removedKeys = result.rows.map((r) => r.key);
    for (const key of removedKeys) await deleteAttachment(key);
  }

  // ② 회원 삭제 CASCADE·저장 실패로 남은 파일. 방금 올리는 중인 파일을 지우지 않게 1시간 넘은 것만
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const files = (await listStoredFiles()).filter((f) => f.modifiedAt.getTime() < hourAgo);
  const known = new Set<string>();
  for (let i = 0; i < files.length; i += 500) {
    const chunk = files.slice(i, i + 500).map((f) => f.key);
    const rows = await db.select({ key: attachments.key }).from(attachments).where(inArray(attachments.key, chunk));
    rows.forEach((r) => known.add(r.key));
  }
  const orphans = files.filter((f) => !known.has(f.key) && !removedKeys.includes(f.key));
  if (!dryRun) for (const f of orphans) await deleteAttachment(f.key);

  // ③ 하루 1번 판단에는 오늘·어제 행만 필요하다 (research R1)
  const yesterday = previousDay(todayKST());
  const oldViews = sql`${postViews.date} < ${yesterday}`;
  const views = dryRun
    ? (await db.select({ n: sql<number>`COUNT(*)::int` }).from(postViews).where(oldViews))[0].n
    : (await db.delete(postViews).where(and(oldViews)).returning({ postId: postViews.postId })).length;

  return { attachments: removedKeys.length, files: orphans.length, views };
}
