"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { posts, postTags, tags } from "@/db/schema";
import { ATTACH_MESSAGES, ATTACHMENT_KEY_RE, type PasteAction } from "@/lib/attachments";
import { POST_REWARD_MIN_LENGTH } from "@/lib/game";
import { parseId } from "@/lib/ids";
import { checkPostInput, parseTags, POST_ERRORS, rawPostInput } from "@/lib/post-rules";
import { classifyPasted, reuploadAttachment as reupload } from "@/server/attachments";
import { requireMember } from "@/server/dal";
import { growForPost } from "@/server/farm";
import { grantReward, lockUser } from "@/server/points";
import { lockLinkableAttachments, resolveCategory, syncPostAttachments } from "@/server/posts";
import { attachmentKeysIn, htmlToText, sanitizePostHtml } from "@/server/sanitize";

// 오류가 나면 입력값을 돌려준다. React 19는 폼 액션 뒤 입력칸을 처음 값으로 되돌리므로 (POST-01 / FR-009, #16)
export type SavePostState = {
  error?: string;
  values?: { title: string; categoryId: string; subcategoryId: string; tags: string };
};

/** 소분류가 다른 대분류 소속일 때 트랜잭션을 되돌리며 빠져나오는 신호 */
class BadCategory extends Error {}

/**
 * 글 저장 (POST-01~04, POST-07, POST-09, GAME-05 / contracts/write-actions.md §2).
 * 검사 1~7은 공용 규칙(postInputSchema), 8은 정화 뒤 본문, 9는 트랜잭션 안 소분류 소속, 10은 수정할 글이 내 블로그 것인지
 */
export async function savePost(_prev: SavePostState, formData: FormData): Promise<SavePostState> {
  const viewer = await requireMember();
  const raw = rawPostInput(formData);
  const values = { title: raw.title, categoryId: raw.categoryId, subcategoryId: raw.subcategoryId, tags: raw.tags };
  const checked = checkPostInput(raw);
  if ("error" in checked) return { error: checked.error, values };
  const input = checked.value;

  // 본문 글자가 비었는지는 붙일 수 없는 첨부를 빼도 같으므로(사진·파일 카드는 0자) 트랜잭션 전에 본다 (FR-008)
  if (!htmlToText(sanitizePostHtml(input.contentHtml))) return { error: POST_ERRORS.contentEmpty, values };

  const blogId = viewer.profile.blogId;
  const tagNames = parseTags(input.tags);

  let postId: number;
  try {
    postId = await db.transaction(async (tx) => {
      await lockUser(tx, viewer.userId);

      // 대분류는 내 블로그 것만(아니면 조용히 비움), 소분류는 고른 대분류 소속만 (FR-032, R15)
      const category = await resolveCategory(tx, blogId, input.categoryId, input.subcategoryId);
      if (category === "bad") throw new BadCategory();

      // 본문의 사진·파일은 이 글에 붙일 수 있는 내 첨부만 남기고, 파일 카드 이름·크기는 DB 값으로 맞춘다 (FR-047, FR-055)
      const known = await lockLinkableAttachments(tx, viewer.userId, input.postId, input.contentHtml);
      const contentHtml = sanitizePostHtml(input.contentHtml, known);
      const contentText = htmlToText(contentHtml);
      const fields = { title: input.title, contentHtml, contentText, ...category, visibility: input.visibility };

      let id: number;
      if (input.postId) {
        // 수정: 내 블로그의 글만. 0행이면 오류 화면으로 (FR-017). 보상·발행 안내 없음, 작성 시각 그대로 (FR-015)
        const [updated] = await tx
          .update(posts)
          .set(fields)
          .where(and(eq(posts.id, input.postId), eq(posts.blogId, blogId)))
          .returning({ id: posts.id });
        if (!updated) throw new Error("NOT_FOUND");
        id = updated.id;
      } else {
        const [created] = await tx.insert(posts).values({ blogId, ...fields }).returning({ id: posts.id });
        id = created.id;

        // 새 공개 글이 충분히 길면 보상 (하루 상한은 grantReward가 확인, GAME-05)
        if (input.visibility === "public" && contentText.length >= POST_REWARD_MIN_LENGTH) {
          const rewarded = (await grantReward(tx, viewer.userId, "post", id)).granted;
          // 글쓰기 보상을 받으면 농장에서 키우는 동물도 함께 자란다 (TOWN-09)
          if (rewarded) await growForPost(tx, viewer.userId);
        }
      }

      await syncPostAttachments(tx, id, attachmentKeysIn(contentHtml));

      // 태그: 없는 태그는 만들고, 글과의 연결을 새로 맞춘다 (FR-041·042)
      if (tagNames.length) {
        await tx.insert(tags).values(tagNames.map((name) => ({ name }))).onConflictDoNothing();
      }
      const tagRows = tagNames.length ? await tx.select({ id: tags.id }).from(tags).where(inArray(tags.name, tagNames)) : [];
      const tagIds = tagRows.map((t) => t.id);
      await tx.delete(postTags).where(and(eq(postTags.postId, id), tagIds.length ? notInArray(postTags.tagId, tagIds) : undefined));
      if (tagIds.length) {
        await tx.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId }))).onConflictDoNothing();
      }
      return id;
    });
  } catch (err) {
    if (err instanceof BadCategory) return { error: POST_ERRORS.bad, values };
    throw err;
  }

  revalidatePath("/", "layout");
  // 보상 여부는 주소에 담지 않는다. 글 상세가 원장을 보고 주인에게만 안내한다 (FR-013, R13)
  redirect(`/@${viewer.profile.blogSlug}/${postId}${input.postId ? "" : "?new=1"}`);
}

/**
 * 글 삭제 (FR-016, contracts/write-actions.md §3): 내 블로그 글만. 태그 연결·댓글·공감·조회 기록은 CASCADE,
 * 첨부는 떨어진다(post_id NULL + detached_at). 보상은 회수하지 않는다
 */
export async function deletePost(postId: number) {
  const viewer = await requireMember();
  if (parseId(postId) === null) return;
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.blogId, viewer.profile.blogId)));
  revalidatePath("/", "layout");
  redirect(`/@${viewer.profile.blogSlug}`);
}

/** 수정 화면이면 글 번호, 새 글이면 null. 잘못된 값이면 undefined */
function currentPostId(postId: unknown): number | null | undefined {
  if (postId === undefined || postId === null) return null;
  return parseId(postId) ?? undefined;
}

/** 붙여 넣은 HTML의 첨부 판정 (FR-047, contracts/write-actions.md §4) */
export async function classifyPastedAttachments(
  keys: string[],
  postId?: number,
): Promise<{ error: string } | { items: { key: string; action: PasteAction; name: string }[] }> {
  const viewer = await requireMember();
  const current = currentPostId(postId);
  const valid = Array.isArray(keys) && keys.length >= 1 && keys.length <= 50 && keys.every((k) => typeof k === "string" && ATTACHMENT_KEY_RE.test(k));
  if (!valid || current === undefined) return { error: POST_ERRORS.bad };
  return { items: await classifyPasted([...new Set(keys)], viewer.userId, current) };
}

/** 내 다른 글·프로필 사진의 첨부를 새 첨부로 복사 (research R8, contracts/write-actions.md §5) */
export async function reuploadAttachment(
  key: string,
  postId?: number,
): Promise<{ error: string } | { ok: { key: string; url: string; kind: "image" | "file"; name: string; size: number } }> {
  const viewer = await requireMember();
  const current = currentPostId(postId);
  if (typeof key !== "string" || !ATTACHMENT_KEY_RE.test(key) || current === undefined) return { error: ATTACH_MESSAGES.failed };
  try {
    const ok = await reupload(key, viewer.userId, current);
    return ok ? { ok } : { error: ATTACH_MESSAGES.failed };
  } catch (err) {
    console.error("첨부 다시 올리기 실패", err);
    return { error: ATTACH_MESSAGES.failed };
  }
}
