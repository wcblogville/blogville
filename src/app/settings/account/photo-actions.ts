"use server";

// 회원정보 수정: 프로필 사진 (ERD 3.9 profiles.photo_key, 사용자 요청 2026-10-12 "정보 수정")
// 사진 파일은 글 첨부와 같은 POST /api/uploads로 먼저 올리고(내 첨부, 어느 글에도 안 붙음), 여기서 그 키를 프로필에 건다.
// 프로필 사진 첨부는 누구나 열 수 있고(attachmentAccess) 정리 작업이 지우지 않는다. 바꾸거나 지운 옛 사진은
// 더는 프로필 사진이 아니라서 하루 뒤 정리 작업(npm run posts:cleanup)이 지운다.
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attachments, profiles } from "@/db/schema";
import { ATTACHMENT_KEY_RE } from "@/lib/attachments";
import { requireMember } from "@/server/dal";

export type PhotoState = { error?: string; ok?: number };

const PHOTO_ERRORS = {
  invalid: "이 사진은 쓸 수 없어요. 다시 올려 주세요",
} as const;

/**
 * 올린 사진을 프로필 사진으로. 내가 올린 사진(image)이고 어느 글에도 붙지 않은 것만 받는다.
 * 그 첨부 행을 잠가(FOR UPDATE) 같은 순간 글 저장이 붙이는 것과 겹치지 않게 한다 (src/server/posts.ts lockLinkableAttachments).
 */
export async function setProfilePhoto(key: string): Promise<PhotoState> {
  const viewer = await requireMember();
  if (typeof key !== "string" || !ATTACHMENT_KEY_RE.test(key)) return { error: PHOTO_ERRORS.invalid };
  const ok = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ key: attachments.key })
      .from(attachments)
      .where(and(eq(attachments.key, key), eq(attachments.userId, viewer.userId), eq(attachments.kind, "image"), isNull(attachments.postId)))
      .for("update");
    if (!row) return false;
    await tx.update(profiles).set({ photoKey: key }).where(eq(profiles.userId, viewer.userId));
    return true;
  });
  if (!ok) return { error: PHOTO_ERRORS.invalid };
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

/** 프로필 사진 지우기: 다시 캐릭터 얼굴이 보인다 */
export async function removeProfilePhoto(): Promise<PhotoState> {
  const viewer = await requireMember();
  await db.update(profiles).set({ photoKey: null }).where(eq(profiles.userId, viewer.userId));
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}
