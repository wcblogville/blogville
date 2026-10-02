"use server";

import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { categories, posts, postTags, tags } from "@/db/schema";
import { POST_REWARD_MIN_LENGTH } from "@/lib/game";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { grantReward, lockUser } from "@/server/points";
import { htmlToText, sanitizePostHtml } from "@/server/sanitize";

const schema = z.object({
  postId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1, "제목을 적어 주세요").max(100, "제목은 100자까지예요"),
  contentHtml: z.string().max(200_000, "글이 너무 길어요"),
  categoryId: z.coerce.number().int().positive().optional(),
  tags: z.string().max(300),
  visibility: z.enum(["public", "private"]),
});

// 오류가 나면 입력값을 돌려준다. React 19는 폼 액션 뒤 입력칸을 처음 값으로 되돌리므로 (POST-01, #16)
export type SavePostState = {
  error?: string;
  values?: { title: string; categoryId: string; tags: string };
};

function parseTags(raw: string) {
  const names = raw
    .split(/[,#\n]/)
    .map((t) => t.trim().replace(/\s+/g, " ").toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 20);
  return [...new Set(names)].slice(0, 10);
}

export async function savePost(_prev: SavePostState, formData: FormData): Promise<SavePostState> {
  const viewer = await requireMember();
  const values = {
    title: String(formData.get("title") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    tags: String(formData.get("tags") ?? ""),
  };
  const parsed = schema.safeParse({
    postId: formData.get("postId") || undefined,
    title: formData.get("title") ?? "",
    contentHtml: formData.get("contentHtml") ?? "",
    categoryId: formData.get("categoryId") || undefined,
    tags: formData.get("tags") ?? "",
    visibility: formData.get("visibility") ?? "public",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const input = parsed.data;
  // 글·카테고리 ID가 DB integer 범위 밖이면 쿼리 오류(500)가 나므로 먼저 막는다 (#21)
  if ((input.postId && parseId(input.postId) === null) || (input.categoryId && parseId(input.categoryId) === null)) {
    return { error: "잘못된 요청이에요", values };
  }

  const contentHtml = sanitizePostHtml(input.contentHtml);
  const contentText = htmlToText(contentHtml);
  if (!contentText) return { error: "본문을 적어 주세요", values };

  const blogId = viewer.profile.blogId;
  const tagNames = parseTags(input.tags);

  let rewarded = false;
  const postId = await db.transaction(async (tx) => {
    await lockUser(tx, viewer.userId);

    // 카테고리는 내 블로그 것만 (다른 블로그의 카테고리 ID를 보내도 무시)
    let categoryId: number | null = null;
    if (input.categoryId) {
      const [cat] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.blogId, blogId)));
      categoryId = cat?.id ?? null;
    }

    let id: number;
    if (input.postId) {
      // 수정: 내 블로그의 글인지 확인
      const [updated] = await tx
        .update(posts)
        .set({ title: input.title, contentHtml, contentText, categoryId, visibility: input.visibility })
        .where(and(eq(posts.id, input.postId), eq(posts.blogId, blogId)))
        .returning({ id: posts.id });
      if (!updated) throw new Error("NOT_FOUND");
      id = updated.id;
    } else {
      const [created] = await tx
        .insert(posts)
        .values({ blogId, title: input.title, contentHtml, contentText, categoryId, visibility: input.visibility })
        .returning({ id: posts.id });
      id = created.id;

      // 새 공개 글이 충분히 길면 보상 (하루 상한은 grantReward가 확인)
      if (input.visibility === "public" && contentText.length >= POST_REWARD_MIN_LENGTH) {
        rewarded = (await grantReward(tx, viewer.userId, "post", id)).granted;
      }
    }

    // 태그: 없는 태그는 만들고, 글과의 연결을 새로 맞춘다
    if (tagNames.length) {
      await tx.insert(tags).values(tagNames.map((name) => ({ name }))).onConflictDoNothing();
    }
    const tagRows = tagNames.length
      ? await tx.select({ id: tags.id }).from(tags).where(inArray(tags.name, tagNames))
      : [];
    const tagIds = tagRows.map((t) => t.id);
    await tx
      .delete(postTags)
      .where(and(eq(postTags.postId, id), tagIds.length ? notInArray(postTags.tagId, tagIds) : undefined));
    if (tagIds.length) {
      await tx.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId }))).onConflictDoNothing();
    }
    return id;
  });

  revalidatePath("/", "layout");
  const query = input.postId ? "" : rewarded ? "?new=reward" : "?new=1";
  redirect(`/@${viewer.profile.blogSlug}/${postId}${query}`);
}

export async function deletePost(postId: number) {
  const viewer = await requireMember();
  if (parseId(postId) === null) return;
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.blogId, viewer.profile.blogId)));
  revalidatePath("/", "layout");
  redirect(`/@${viewer.profile.blogSlug}`);
}
